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
    let isGetDataActive = false;
    let isSendDataActive = false;
    let logs = '';
    let showPortDialog = false;
    let showSettingsDialog = false;
    let connectionState = DISCONNECTED;
    let error = null;
    let stmApi = null;
    let parNum = 0;
    let deviceInfo = {
        family: '-',
        bl: '-',
        pid: '-',
        serial_num: 0,
        commands: [],
        temperature: 999,
        inp0: 0,
        inp1: 0,
        source: 0,
        revision: 999,
        range_start: 0,
        range_end: 0,
        hue_start: 0,
        hue_end: 0,
        saturation: 0,
        c_value: 0,
        backlight_value: 0,
        backlight_saturation: 0,
        backlight_hue: 0
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

    function modbusSetParameters()
    {
        if (isSendDataActive&&isConnected&&settings._modbus)
        {
            deviceInfo.family = "IV";
            var sliderRangeMin = document.getElementById('sliderRangeMin');
            var sliderRangeMax = document.getElementById('sliderRangeMax');
            var sliderHStart = document.getElementById('sliderHStart');
            var sliderHEnd = document.getElementById('sliderHEnd');
            var sliderS = document.getElementById('sliderS');
            var sliderV = document.getElementById('sliderV');
            var sliderHBl = document.getElementById('sliderHBl');
            var sliderSBl = document.getElementById('sliderSBl');
            var sliderVBl = document.getElementById('sliderVBl');
            deviceInfo.range_start = sliderRangeMin.value*1;
            deviceInfo.range_end = sliderRangeMax.value*1;
            deviceInfo.hue_start = sliderHStart.value*1;
            deviceInfo.hue_end = sliderHEnd.value*1;
            deviceInfo.c_value = sliderV.value*1;
            deviceInfo.saturation = sliderS.value*1;
            deviceInfo.backlight_value = sliderVBl.value*1;
            deviceInfo.backlight_hue = sliderHBl.value*1;
            deviceInfo.backlight_saturation = sliderSBl.value*1;
            console.log('color value:'+sliderS.value);
            if (parNum==0)
                stmApi.cmdModbusWRITEReg(11,deviceInfo.range_start);
            else if(parNum==1)
                stmApi.cmdModbusWRITEReg(12,deviceInfo.range_end);
            else if(parNum==2)
                stmApi.cmdModbusWRITEReg(15,deviceInfo.c_value);
            else if(parNum==3)
                stmApi.cmdModbusWRITEReg(16,deviceInfo.saturation);
            else if(parNum==4)
                stmApi.cmdModbusWRITEReg(17,deviceInfo.hue_start);
            else if(parNum==5)
                stmApi.cmdModbusWRITEReg(18,deviceInfo.hue_end);
            else if(parNum==6)
                stmApi.cmdModbusWRITEReg(20,deviceInfo.backlight_value);
            else if(parNum==7)
                stmApi.cmdModbusWRITEReg(21,deviceInfo.backlight_saturation);
            else if(parNum==8)
                stmApi.cmdModbusWRITEReg(22,deviceInfo.backlight_hue);
            else if(parNum==9)
                stmApi.cmdModbusWRITEReg(0xABCD,0xABCD);
            parNum+=1;
            if (parNum==10)
                parNum=0;

            /*stmApi.cmdModbusWRITEReg(11,deviceInfo.range_start)
            .then(()=>{
                stmApi.cmdModbusWRITEReg(12,deviceInfo.range_end);
            })
            .then(()=>{
                stmApi.cmdModbusWRITEReg(15,deviceInfo.c_value);
            })
            .then(()=>{
                stmApi.cmdModbusWRITEReg(16,deviceInfo.saturation);
            })
            .then(()=>{
                stmApi.cmdModbusWRITEReg(17,deviceInfo.hue_start);
            })
            .then(()=>{
                stmApi.cmdModbusWRITEReg(18,deviceInfo.hue_end);
            })
            .then(()=>{
                stmApi.cmdModbusWRITEReg(20,deviceInfo.backlight_value);
            })
            .then(()=>{
                stmApi.cmdModbusWRITEReg(21,deviceInfo.backlight_saturation);
            })
            .then(()=>{
                stmApi.cmdModbusWRITEReg(22,deviceInfo.backlight_hue);
            })
            .then(()=>{
                stmApi.cmdModbusWRITEReg(0xABCD,0xABCD);
            });*/
        }
    }

    function modbusGetDataTimer()
    {
        if (isGetDataActive&&settings._modbus)
        {
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
                deviceInfo.range_start = info.range_min;
                deviceInfo.range_end = info.range_max;
                deviceInfo.hue_start = info.hue_start;
                deviceInfo.hue_end = info.hue_end;
                deviceInfo.c_value = info.c_value;
                deviceInfo.saturation = info.saturation;
                deviceInfo.backlight_value = info.backlight_value;
                deviceInfo.backlight_hue = info.backlight_hue;
                deviceInfo.backlight_saturation = info.backlight_saturation;
                updateSliders();
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
    }

    function onToggleGetData(go) {
        const dataLabel = document.getElementById("getDataLabel");
        if (isGetDataActive) {
            // If it's currently active, change to "Get data"
            dataLabel.textContent = "Get data";
        } else {
            // If it's not active, change to "Stop get data"
            dataLabel.textContent = "Stop get data";
        }
        // Toggle the state for the next click
        isGetDataActive = !isGetDataActive;
    }

    function onToggleSendData(go) {
        const dataLabel = document.getElementById("sendDataLabel");
        if (isSendDataActive) {
            // If it's currently active, change to "Get data"
            dataLabel.textContent = "Send data";
        } else {
            // If it's not active, change to "Stop get data"
            dataLabel.textContent = "Stop send data";
        }
        // Toggle the state for the next click
        isSendDataActive = !isSendDataActive;
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
            serial_num: 0,
            commands: [],
            temperature: 999,
            inp0: 0,
            inp1: 0,
            source: 0,
            revision: 999,
            range_start: 0,
            range_end: 0,
            hue_start: 0,
            hue_end: 0,
            saturation: 0,
            c_value: 0,
            backlight_value: 0,
            backlight_saturation: 0,
            backlight_hue: 0
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
                        deviceInfo.inp0 = info.inp0/1000;
                        deviceInfo.inp1 = info.inp1/1000;
                        deviceInfo.revision = info.revision;
                        deviceInfo.temperature = info.temperature;
                        return Promise.resolve('IV Modbus');
                    }
                })
                .then((pid) => {
                    deviceInfo.pid = pid;
                    updateCaptions();
                })
                .then(()=> {
                    return stmApi.cmdREAD(0x1ffff7e8,12);
                }
                )
                .then((data)=>{
                    deviceInfo.serial_num = "0x" + data.map(byte => byte.toString(16).padStart(2, '0')).join('');
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

    function updateSliders()
    {
        var sliderRangeMin = document.getElementById('sliderRangeMin');
        var sliderRangeMax = document.getElementById('sliderRangeMax');
        var sliderHStart = document.getElementById('sliderHStart');
        var sliderHEnd = document.getElementById('sliderHEnd');
        var sliderS = document.getElementById('sliderS');
        var sliderV = document.getElementById('sliderV');
        var sliderHBl = document.getElementById('sliderHBl');
        var sliderSBl = document.getElementById('sliderSBl');
        var sliderVBl = document.getElementById('sliderVBl');

        updateSliderValue(sliderRangeMin,deviceInfo.range_start);
        updateSliderValue(sliderRangeMax,deviceInfo.range_end);
        updateSliderValue(sliderHStart,deviceInfo.hue_start);
        updateSliderValue(sliderHEnd,deviceInfo.hue_end);
        updateSliderValue(sliderS,deviceInfo.saturation);
        updateSliderValue(sliderV,deviceInfo.c_value);
        updateSliderValue(sliderHBl,deviceInfo.backlight_hue);
        updateSliderValue(sliderSBl,deviceInfo.backlight_saturation);
        updateSliderValue(sliderVBl,deviceInfo.backlight_value);
        updateCaptions();
    }

    function updateCaptions()
    {
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

        var sliderHBl = document.getElementById('sliderHBl');
        var sliderHBlOut = document.querySelector('output[for="sliderHBl"]');

        var sliderSBl = document.getElementById('sliderSBl');
        var sliderSBlOut = document.querySelector('output[for="sliderSBl"]');

        var sliderVBl = document.getElementById('sliderVBl');
        var sliderVBlOut = document.querySelector('output[for="sliderVBl"]');

        updateSliderOutput(sliderRangeMinOut,sliderRangeMin,"Range Min(V): ");
        updateSliderOutput(sliderRangeMaxOut,sliderRangeMax,"Range Max(V): ");
        updateSliderOutput(sliderHStartOut,sliderHStart,"Hue Start: ");
        updateSliderOutput(sliderHEndOut,sliderHEnd,"Hue End: ");
        updateSliderOutput(sliderSOut,sliderS,"C.Sat: ");
        updateSliderOutput(sliderVOut,sliderV,"C.Val: ");
        updateSliderOutput(sliderHBlOut,sliderHBl,"Bl.C.Hue: ");
        updateSliderOutput(sliderSBlOut,sliderSBl,"Bl.C.Sat: ");
        updateSliderOutput(sliderVBlOut,sliderVBl,"Bl.C.Val: ");
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

    var sliderHBl = document.getElementById('sliderHBl');
    var sliderHBlOut = document.querySelector('output[for="sliderHBl"]');

    var sliderSBl = document.getElementById('sliderSBl');
    var sliderSBlOut = document.querySelector('output[for="sliderSBl"]');

    var sliderVBl = document.getElementById('sliderVBl');
    var sliderVBlOut = document.querySelector('output[for="sliderVBl"]');


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

    // Add an event listener to detect changes in the slider value
    sliderHBl.addEventListener('input', function() {
      // Update the output caption with the current slider value
      updateSliderOutput(sliderHBlOut,sliderHBl,"Bl.C.Hue: ");
    });

    // Add an event listener to detect changes in the slider value
    sliderSBl.addEventListener('input', function() {
      // Update the output caption with the current slider value
      updateSliderOutput(sliderSBlOut,sliderSBl,"Bl.C.Sat: ");
    });

    // Add an event listener to detect changes in the slider value
    sliderVBl.addEventListener('input', function() {
      // Update the output caption with the current slider value
      updateSliderOutput(sliderVBlOut,sliderVBl,"Bl.C.Val: ");
    });

    updateCaptions();

    setInterval(modbusGetDataTimer, 1000);
    setInterval(modbusSetParameters,500);
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
                    class:is-hidden={!cmdsAllowed || settings._modbus}
                    on:click={onErase}>
                    <span class="icon"><i class="fa fa-eraser" /></span>
                    <span>Full Erase</span>
                </a>
                <a
                    class="navbar-item"
                    class:is-hidden={!selectedFile || !cmdsAllowed || settings._modbus}
                    on:click={() => onFlash(false)}>
                    <span class="icon"><i class="fas fa-pen" /></span>
                    <span>Flash</span>
                </a>
                <a
                    class="navbar-item"
                    class:is-hidden={!selectedFile || !cmdsAllowed || settings._modbus}
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
                    class:is-hidden={!settings._modbus || !isConnected}
                    on:click={() => onToggleGetData()}>
                    <span class="icon"><i class="fa fa-car" /></span>
                    <span id="getDataLabel">Get data</span>
                </a>
                <a
                    class="navbar-item"
                    class:is-hidden={!settings._modbus || !isConnected}
                    on:click={() => onToggleSendData()}>
                    <span class="icon"><i class="fa fa-car" /></span>
                    <span id="sendDataLabel">Send data</span>
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
                                <div class="value">{deviceInfo.serial_num}</div>
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
                                <div class="label">Input 0, V:</div>
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
                                <div class="label">Input 1, V:</div>
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
                                <div class="label">Source:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="value">{deviceInfo.source}</div>
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
                                <input id="sliderRangeMin" class="slider" min="0" max="12000" value="0" step="100" type="range">
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
                                <input id="sliderRangeMax" class="slider" min="0" max="30000" value="0" step="100" type="range">
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
                                <input id="sliderHStart" class="slider" min="0" max="255" value="0" step="1" type="range">
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
                                <input id="sliderHEnd" class="slider" min="0" max="255" value="0" step="1" type="range">
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
                                <input id="sliderS" class="slider" min="0" max="255" value="0" step="1" type="range">
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
                                <input id="sliderV" class="slider" min="0" max="255" value="0" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderHBl" id="sliderHBlTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderHBl" class="slider" min="0" max="255" value="0" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderSBl" id="sliderSBlTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderSBl" class="slider" min="0" max="255" value="0" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderVBl" id="sliderVBlTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderVBl" class="slider" min="0" max="255" value="0" step="1" type="range">
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