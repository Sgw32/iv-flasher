<script>
    import settings from './api/Settings';
    import logger from './api/Logger';
    import PortDialog from './PortDialog.svelte';
    import SettingsDialog from './SettingsDialog.svelte';
    import NotSupportedDialog from './NotSupportedDialog.svelte';
    import { fade } from 'svelte/transition';
    import { onMount } from 'svelte';
    import WebSerial from './api/WebSerial';
    import { STMApi } from './api/STMapi';
    import tools from './tools';

    
    const DISCONNECTED = 'disconnected';
    const CONNECTING = 'connecting';
    const CONNECTED = 'connected';

    let burgerActive = false;
    let selectedFile = null;
    let selectedPort = null;
    let logs = '';
    let showPortDialog = false;
    let showSettingsDialog = false;
    let connectionState = DISCONNECTED;
    let error = null;
    let stmApi = null;
    let deviceInfo = {
        family: '-',
        bl: '-',
        pid: '-',
        commands: [],
        temperature: 999,
        inp0: 0,
        inp1: 0,
        revision: 999
    };
    let stm8selected = false;
    let sending = false;

    logger.registerLogger({
        log(...args) {
            log(args[0]);
        },
    });

    function onSelectPort() {
        error = null;
        showPortDialog = true;
    }

    function onBurgerClick() {
        burgerActive = !burgerActive;
    }

    function log(message) {
        logs += message + '\n';
    }

    function onPortSelected(event) {
        error = null;
        selectedPort = event.detail;
        let serial = new WebSerial(selectedPort);
        serial.onConnect = () => {};
        serial.onDisconnect = () => {
            sending = false;
            connectionState = DISCONNECTED;
            //logs = '';
        };
        stmApi = new STMApi(serial);
    }

    function onOpenFile(event) {
        error = null;
        selectedFile = event.target.files[0];
    }

    function onGetData(go) {
        
        stmApi.cmdGET().then((info) => {
            deviceInfo.bl = info.blVersion;
            deviceInfo.commands = info.commands;
            console.log("Setting data");
            if (!settings._modbus)
            {
                deviceInfo.family = info.getFamily();
                if (deviceInfo.family === 'STM32') {
                    //deviceInfo.family = '32-bit'
                    return stmApi.cmdGID();
                } else {
                    return Promise.resolve('-');
                }
            }
            else
            {
                deviceInfo.family = "IV";
                deviceInfo.inp0 = info.inp0;
                deviceInfo.inp1 = info.inp1;
                deviceInfo.revision = info.revision;
                deviceInfo.temperature = info.temperature;
                return Promise.resolve('IV Modbus');
            }
        })
        .catch((err) => {
            log(err);
            console.log(err);
            if (err!=undefined)
            {
                error = err.message;    
            }
        });
    }

    function onFlash(go) {
        error = null;
        sending = true;
        log('Reading content of the file ' + selectedFile.name);
        tools
            .readFile(selectedFile)
            .then(async (content) => {
                log('Parsing content of the file');
                const ext = tools.extension(selectedFile.name);
                let startAddress;
                let records;
                if (ext === 's19') {
                    records = tools.parseSRec(
                        true,
                        stmApi.writeBlockSize,
                        content
                    );
                } else if (ext === 'hex' || ext === 'ihx') {
                    records = tools.parseHex(
                        true,
                        stmApi.writeBlockSize,
                        content
                    );
                } else if (ext === 'bin') {
                    startAddress = parseInt(settings.startAddress);
                    records = [
                        {
                            type: 'data',
                            data: new Uint8Array(content),
                            address: startAddress,
                        },
                    ];
                }

                for (let i = 0; i < records.length; i++) {
                    let rec = records[i];

                    if (rec.type === 'data') {
                        let before_log = logs;
                        await stmApi.write(rec.data, rec.address, (i, blocksCount) => {
                            logs = before_log + 'Writing block ' + (i + 1) + '/' + blocksCount + '\n';
                        });
                    } else if (rec.type === 'start') {
                        log(
                            'Start address detected: 0x' +
                                rec.address.toString(16)
                        );
                        startAddress = rec.address;
                    }
                }

                if (go) {
                    startAddress =
                        startAddress || parseInt(settings.startAddress);
                    log('Starting code execution');
                    await stmApi.cmdGO(startAddress);
                    stmApi.disconnect();
                    connectionState = DISCONNECTED;
                }

                sending = false;
            })
            .catch((err) => {
                sending = false;
                error = err.message;
            });
    }

    function onConnect() {
        deviceInfo = {
            family: '-',
            bl: '-',
            pid: '-',
            commands: [],
            temperature: 999,
            inp0: 0,
            inp1: 0,
            revision: 999
        };

        if (connectionState === DISCONNECTED) {
            connectionState = CONNECTING;
            error = null;
            stmApi
                .connect({
                    replyMode: settings.replyMode,
                    baudrate: settings.baudrate,
                    mcutype: settings.mcuType,
                    modbus: settings._modbus
                })
                .then(() => {
                    connectionState = CONNECTED;
                    return stmApi.cmdGET();
                })
                .then((info) => {
                    deviceInfo.bl = info.blVersion;
                    deviceInfo.commands = info.commands;
                    
                    if (!settings._modbus)
                    {
                        deviceInfo.family = info.getFamily();
                        if (deviceInfo.family === 'STM32') {
                            //deviceInfo.family = '32-bit'
                            return stmApi.cmdGID();
                        } else {
                            return Promise.resolve('-');
                        }
                    }
                    else
                    {
                        deviceInfo.family = "IV";
                        deviceInfo.inp0 = info.inp0;
                        deviceInfo.inp1 = info.inp1;
                        deviceInfo.revision = info.revision;
                        deviceInfo.temperature = info.temperature;
                        return Promise.resolve('IV Modbus');
                    }
                })
                .then((pid) => {
                    deviceInfo.pid = pid;
                })
                .then(()=> {
                    return stmApi.cmdREAD(0x1ffff7e8,12);
                }
                )
                .then((data)=>{
                    console.log(data);
                    return Promise.resolve();
                })
                .then(() => 
                {
                    if (settings._modbus)
                    {
                        log("Modbus enabled");
                    }
                    else
                    {
                        log("Modbus not enabled");
                    }
                })
                .catch((err) => {
                    log(err);
                    console.log(err);
                    if (err!=undefined)
                    {
                        error = err.message;    
                    }
                    connectionState = DISCONNECTED;
                });
        } else {
            stmApi.disconnect().catch((err) => {
                if (err!=undefined)
                {
                    error = err.message;    
                }
                console.log(err)
            });
        }
    }

    function onErase() {
        error = null;
        sending = true;
        log('Erasing flash...');
        stmApi
            .eraseAll()
            .then(() => {
                log('Flash erased');
                sending = false;
            })
            .catch((err) => {
                sending = false;
                error = err.message;
            });
    }

    function onSettings() {
        error = null;
        showSettingsDialog = true;
    }

    function onStm8Select(event) {
        let value = event.target.value;
        stm8selected = value !== '-1';
        stmApi.setDevice({
            blVersion: deviceInfo.bl,
            flash: stm8selected ? value : null,
        });
    }

    function updateSliderValue(sl,val)
    {
        sl.value=val;
    }

    function updateCaptions()
    {
        updateSliderOutput(sliderRangeMinOut,sliderRangeMin,"Range Min(V): ");
        updateSliderOutput(sliderRangeMaxOut,sliderRangeMax,"Range Max(V): ");
        updateSliderOutput(sliderHStartOut,sliderHStart,"Hue Start: ");
        updateSliderOutput(sliderHEndOut,sliderHEnd,"Hue End: ");
        updateSliderOutput(sliderSOut,sliderS,"C.Sat: ");
        updateSliderOutput(sliderVOut,sliderV,"C.Val: ");
    }

    function updateSliderOutput(el,sl,txt)
    {
        el.textContent = txt + sl.value;
    }

    onMount(() => {
    // Get the slider and output elements
    var sliderRangeMin = document.getElementById('sliderRangeMin');
    var sliderRangeMinOut = document.querySelector('output[for="sliderRangeMin"]');
    var sliderRangeMax = document.getElementById('sliderRangeMax');
    var sliderRangeMaxOut = document.querySelector('output[for="sliderRangeMax"]');
    

    var sliderHStart = document.getElementById('sliderHStart');
    var sliderHStartOut = document.querySelector('output[for="sliderHStart"]');

    var sliderHEnd = document.getElementById('sliderHEnd');
    var sliderHEndOut = document.querySelector('output[for="sliderHEnd"]');

    var sliderS = document.getElementById('sliderS');
    var sliderSOut = document.querySelector('output[for="sliderS"]');

    var sliderV = document.getElementById('sliderV');
    var sliderVOut = document.querySelector('output[for="sliderV"]');

    // Add an event listener to detect changes in the slider value
    sliderRangeMin.addEventListener('input', function() {
      // Update the output caption with the current slider value
      updateSliderOutput(sliderRangeMinOut,sliderRangeMin,"Range Min(V): ");
    });

    // Add an event listener to detect changes in the slider value
    sliderRangeMax.addEventListener('input', function() {
      // Update the output caption with the current slider value
      updateSliderOutput(sliderRangeMaxOut,sliderRangeMax,"Range Max(V): ");
    });

    // Add an event listener to detect changes in the slider value
    sliderHStart.addEventListener('input', function() {
      // Update the output caption with the current slider value
      updateSliderOutput(sliderHStartOut,sliderHStart,"Hue Start: ");
    });

    // Add an event listener to detect changes in the slider value
    sliderHEnd.addEventListener('input', function() {
      // Update the output caption with the current slider value
      updateSliderOutput(sliderHEndOut,sliderHEnd,"Hue End: ");
    });

    // Add an event listener to detect changes in the slider value
    sliderS.addEventListener('input', function() {
      // Update the output caption with the current slider value
      updateSliderOutput(sliderSOut,sliderS,"C.Sat: ");
    });

    // Add an event listener to detect changes in the slider value
    sliderV.addEventListener('input', function() {
      // Update the output caption with the current slider value
      updateSliderOutput(sliderVOut,sliderV,"C.Val: ");
    });

    updateSliderOutput(sliderRangeMinOut,sliderRangeMin,"Range Min(V): ");
    updateSliderOutput(sliderRangeMaxOut,sliderRangeMax,"Range Max(V): ");
    updateSliderOutput(sliderHStartOut,sliderHStart,"Hue Start: ");
    updateSliderOutput(sliderHEndOut,sliderHEnd,"Hue End: ");
    updateSliderOutput(sliderSOut,sliderS,"C.Sat: ");
    updateSliderOutput(sliderVOut,sliderV,"C.Val: ");
    }
    );

    $: isConnected = connectionState === CONNECTED;
    $: isConnecting = connectionState === CONNECTING;
    $: isDisconnected = connectionState === DISCONNECTED;
    $: cmdsAllowed =
        isConnected &&
        !sending &&
        (deviceInfo.family === 'STM32' ||
            (deviceInfo.family === 'STM8' && stm8selected));
</script>

<style>
    #subtitle {
        position: absolute;
        bottom: 0;
        right: 0;
        color: crimson;
    }

    .disabled {
        pointer-events: none;
        opacity: 0.4;
    }
</style>

<!-- svelte-ignore a11y-missing-attribute -->
<!-- svelte-ignore a11y-no-onchange -->
<div id="app">
    <div class="navbar has-shadow">
        <div class="navbar-brand">
            <h1 class="navbar-item is-size-5 mr-3 pt-1">
                IV-Flasher<span id="subtitle" class="is-size-6">serial</span>
            </h1>

            <a
                role="button"
                class="navbar-burger burger {burgerActive ? 'is-active' : ''}"
                aria-label="menu"
                aria-expanded="false"
                data-target="blpnavbar"
                on:click={onBurgerClick}>
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span aria-hidden="true" />
            </a>
        </div>

        <div
            id="blpnavbar"
            class="navbar-menu {burgerActive ? 'is-active' : ''}">
            <div class="navbar-start">
                <a class="navbar-item">
                    <div class="file">
                        <label class="file-label">
                            <input
                                class="file-input"
                                type="file"
                                accept=".s19,.hex,.ihx,.bin"
                                name="file"
                                on:change={onOpenFile} />
                            <span class="icon">
                                <i class="fa fa-folder-open" />
                            </span>
                            <span class="file-label">Open File</span>
                        </label>
                    </div>
                </a>

                <a
                    class="navbar-item"
                    class:disabled={isConnecting || !selectedPort}
                    on:click={onConnect}>
                    <span class="icon"><i
                            class="fa {isConnected ? 'fa-unlink' : 'fa-link'}" /></span>
                    <span>{isConnected ? 'Disconnect' : 'Connect'}</span>
                </a>
                <a
                    class="navbar-item"
                    class:disabled={!cmdsAllowed}
                    on:click={onErase}>
                    <span class="icon"><i class="fa fa-eraser" /></span>
                    <span>Full Erase</span>
                </a>
                <a
                    class="navbar-item"
                    class:disabled={!selectedFile || !cmdsAllowed}
                    on:click={() => onFlash(false)}>
                    <span class="icon"><i class="fas fa-pen" /></span>
                    <span>Flash</span>
                </a>
                <a
                    class="navbar-item"
                    class:disabled={!selectedFile || !cmdsAllowed}
                    on:click={() => onFlash(true)}>
                    <span class="icon"><i class="fa fa-play" /></span>
                    <span>Flash & Go</span>
                </a>
                <a class="navbar-item" on:click={onSettings}>
                    <span class="icon"><i class="fa fa-cog" /></span>
                    <span>Settings</span>
                </a>
                <a
                    class="navbar-item"
                    class:disabled={!settings._modbus || !isConnected}
                    on:click={() => onGetData()}>
                    <span class="icon"><i class="fa fa-car" /></span>
                    <span>Get data</span>
                </a>
                <div class="navbar-item">
                   <div class="select">
                        <select id="mcuType" bind:value={settings.mcutype}>
                            <option value="Artery">Artery</option>
                            <option value="STM32">STM32</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="navbar-end">
                <a
                    class="navbar-item"
                    class:disabled={!isDisconnected}
                    on:click={onSelectPort}>
                    <span class="icon"><i class="fas fa-plug" /></span>
                    <span>{selectedPort ? selectedPort.name : 'Select port'}</span>
                </a>
            </div>
        </div>
    </div>
    {#if selectedFile}
        <div class="container is-fluid is-paddingless" in:fade>
            <div class="notification is-info py-2">
                File: {selectedFile.name}
            </div>
        </div>
    {/if}
    {#if error}
        <div class="container is-fluid is-paddingless" in:fade out:fade>
            <div class="notification is-danger">Error: {error}</div>
        </div>
    {/if}

    <div class="container is-fluid mt-4">
        <div class="columns">
            <div class="column is-narrow" style="min-width: 360px;">
                <div class="box" id="devinfo">
                    <p class="title is-5">Device Info</p>
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">Family:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="value">{(deviceInfo.family=='STM32') ? '32-bit' : '8-bit'}</div>
                            </div>
                        </div>
                    </div>
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">Bootloader:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="value">{deviceInfo.bl}</div>
                            </div>
                        </div>
                    </div>
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">Product ID:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="value">{deviceInfo.pid}</div>
                            </div>
                        </div>
                    </div>
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">Serial number:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="value">{deviceInfo.pid}</div>
                            </div>
                        </div>
                    </div>
                    <div
                        class="level is-mobile"
                        class:is-hidden={deviceInfo.family !== 'STM8'}>
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">STM8 type:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="select value">
                                    <select
                                        id="devices"
                                        on:change={onStm8Select}>
                                        <option value="-1" selected>
                                            Select device...
                                        </option>
                                        <option value="32">STM8 S/A 32K</option>
                                        <option value="128">
                                            STM8 S/A 128K
                                        </option>
                                        <option value="256">
                                            STM8 S/A 256K
                                        </option>
                                        <option value="0">STM8 L</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="column">
                <div class="box">
                    <p class="title is-5">Log Messages</p>
                    <pre>{logs}</pre>
                </div>
            </div>
            <div class="column is-narrow" style="min-width: 360px;">
                <div class="box" id="devinfo">
                    <p class="title is-5">Sensors data</p>
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">Revision:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="value">{(deviceInfo.revision)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">Temperature:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="value">{deviceInfo.temperature}</div>
                            </div>
                        </div>
                    </div>
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">Input 0:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="value">{deviceInfo.inp0}</div>
                            </div>
                        </div>
                    </div>
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">Input 1:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="value">{deviceInfo.inp1}</div>
                            </div>
                        </div>
                    </div>

                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderRangeMin" id="sliderRangeMinTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderRangeMin" class="slider" min="0" max="12000" value="0" step="1" type="range">
                            </div>
                        </div>
                    </div>

                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderRangeMax" id="sliderRangeMaxTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderRangeMax" class="slider" min="0" max="30000" value="10000" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderHStart" id="sliderHStartTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderHStart" class="slider" min="0" max="255" value="255" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderHEnd" id="sliderHEndTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderHEnd" class="slider" min="0" max="255" value="255" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderS" id="sliderSTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderS" class="slider" min="0" max="255" value="255" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderV" id="sliderVTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderV" class="slider" min="0" max="255" value="255" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    
                    
                </div>
            </div>
        </div>
    </div>

    
    {#if showPortDialog}
        <PortDialog
            on:close={() => (showPortDialog = false)}
            on:selected_port={onPortSelected} />
    {/if}

    {#if showSettingsDialog}
        <SettingsDialog on:close={() => (showSettingsDialog = false)} />
    {/if}

    {#if !navigator.serial}
        <NotSupportedDialog/>
    {/if}
</div>