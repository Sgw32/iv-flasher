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
    import { getFirestore, collection, getDocs } from "firebase/firestore";
    // Initialize Firebase
    import { firebaseConfig } from "./firebaseConfig"; // Import your Firebase configuration
    import { initializeApp } from "firebase/app";
    const firebaseApp = initializeApp(firebaseConfig);

    function getHueColor(hueValue) {
        const hue = (hueValue / 255) * 360; // Convert 0-255 to 0-360 degrees
        return `hsl(${hue}, 100%, 50%)`;
    }

    // Declare variables for DOM elements
    let sliderBarMode, sliderBarModeOut;
    let sliderSource, sliderSourceOut;
    let sliderRangeMin, sliderRangeMinOut;
    let sliderRangeMax, sliderRangeMaxOut;
    let sliderH1, sliderH1Out;
    let sliderH2, sliderH2Out;
    let sliderH3, sliderH3Out; 
    let sliderH4, sliderH4Out; 

    let sliderH1Pos, sliderH1PosOut;
    let sliderH2Pos, sliderH2PosOut;
    let sliderH3Pos, sliderH3PosOut; 
    
    let sliderHStart, sliderHStartOut;
    let sliderHEnd, sliderHEndOut;
    let sliderS, sliderSOut;
    let sliderV, sliderVOut;
    let sliderHBl, sliderHBlOut;
    let sliderSBl, sliderSBlOut;
    let sliderVBl, sliderVBlOut;

    let selectTypePreset; // Pre-declare the function

    // Firestore instance
    const db = getFirestore(firebaseApp);
    

    // Array to store data from documents
    let presetsData = [];

    // State to store the "mcuid" values
    let mcuidArray = [];

    // Function to add options to the select element
    function addOption(text, value, isSelected) {
        const option = document.createElement("option");
        const selectPresets = document.getElementById("dType");
        option.text = text;
        option.value = value;
        if (isSelected) {
            option.selected = true;
        }
        console.log(option);
        console.log(selectPresets);
        selectPresets.appendChild(option);
    }
    
    // Function to fetch the number of documents
    const fetchGeniuneIDs = async () => {
        const querySnapshot = await getDocs(collection(db, "iv-indicators-ids"));
        
        // Reset arrays
        mcuidArray = [];

        querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Print document structure
        console.log("Document Structure:", data);

        // Parse "mcuid" field and store it in the array
        const mcuid = data.mcuid;
        mcuidArray.push(mcuid);
        });

        // Print the array of "mcuid" values
        console.log("mcuid Array:", mcuidArray);
    };

    // Function to check if id is in mcuidArray
    const checkGeniune = (id) => {
        //return mcuidArray.includes(id);
        return true;
    };

    const fetchIndicatorPresets = async () => {
        const querySnapshot = await getDocs(collection(db, "iv-indicators-presets"));
        presetsData = [];
        let firstPreset = "";
        querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Print document structure
        console.log("Document Structure:", data);
        presetsData.push(data);
        // Parse "mcuid" field and store it in the array
        const p_name = data.name;
        if (firstPreset=="")
            firstPreset=p_name;
        addOption(p_name, p_name, false);
        });
        console.log(presetsData);
        // Ensure the function is defined before calling it
        if (typeof selectTypePreset === "function") {
            selectTypePreset(firstPreset);
        } else {
            console.error("selectTypePreset is not defined yet.");
        }
    };

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
        bar_mode: 0,
        revision: 999,
        range_start: 0,
        range_end: 0,
        hue_start: 0,
        hue_end: 0,
        saturation: 0,
        c_value: 0,
        backlight_value: 0,
        backlight_saturation: 0,
        backlight_hue: 0,
        color_pos1: 0,
        color_pos2:  0,
        color_pos3:  0,
        color_hues_fill1:  0,
        color_hues_fill2:  0,
        color_hues_fill3:  0,
        color_hues_fill4:  0,
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
            deviceInfo.bar_mode = sliderBarMode.value*1;
            deviceInfo.source = sliderSource.value*1;
            deviceInfo.range_start = sliderRangeMin.value*1;
            deviceInfo.range_end = sliderRangeMax.value*1;
            deviceInfo.hue_start = sliderHStart.value*1;
            deviceInfo.hue_end = sliderHEnd.value*1;
            deviceInfo.c_value = sliderV.value*1;
            deviceInfo.saturation = sliderS.value*1;
            deviceInfo.backlight_value = sliderVBl.value*1;
            deviceInfo.backlight_hue = sliderHBl.value*1;
            deviceInfo.backlight_saturation = sliderSBl.value*1;

            deviceInfo.color_hues_fill1 = sliderH1.value*1;
            deviceInfo.color_hues_fill2 = sliderH2.value*1;
            deviceInfo.color_hues_fill3 = sliderH3.value*1;
            deviceInfo.color_hues_fill4 = sliderH4.value*1;

            deviceInfo.color_pos1 = sliderH1Pos.value*1;
            deviceInfo.color_pos2 = sliderH2Pos.value*1;
            deviceInfo.color_pos3 = sliderH3Pos.value*1;

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
                stmApi.cmdModbusWRITEReg(10,(deviceInfo.source&0xFF)|((deviceInfo.bar_mode&0xFF)<<8));
            else if(parNum==10)
                stmApi.cmdModbusWRITEReg(19,(deviceInfo.color_pos1&0xF)|((deviceInfo.color_pos2&0xF)<<4)|((deviceInfo.color_pos3&0xF)<<8));
            else if(parNum==11)
                stmApi.cmdModbusWRITEReg(23,(deviceInfo.color_hues_fill1&0xFF)|((deviceInfo.color_hues_fill2&0xFF)<<8));
            else if(parNum==12)
                stmApi.cmdModbusWRITEReg(24,(deviceInfo.color_hues_fill3&0xFF)|((deviceInfo.color_hues_fill4&0xFF)<<8));
            else if(parNum==13)
                stmApi.cmdModbusWRITEReg(0xABCD,0xABCD);
            parNum+=1;
            if (parNum==14)
                parNum=0;
        }
    }

    function modbusGetDataTimer()
    {
        if (isGetDataActive&&settings._modbus)
        {
            stmApi.cmdGET().then((info) => {
            if (info.data_valid==1)
            {
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
                    deviceInfo.color_hues_fill1 = info.color_hues_fill1;
                    deviceInfo.color_hues_fill2 = info.color_hues_fill2;
                    deviceInfo.color_hues_fill3 = info.color_hues_fill3;
                    deviceInfo.color_hues_fill4 = info.color_hues_fill4;
                    deviceInfo.color_pos1 = info.color_pos1;
                    deviceInfo.color_pos2 = info.color_pos2;
                    deviceInfo.color_pos3 = info.color_pos3;
                    deviceInfo.source = info.source;                    
                    deviceInfo.bar_mode = info.bar_mode;                    
                    updateSliders();
                    return Promise.resolve('IV Modbus');
                }
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
        isSendDataActive = false;
        const other_dataLabel = document.getElementById("sendDataLabel");
        other_dataLabel.textContent = "Send data";
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
        isGetDataActive = false;
        const other_dataLabel = document.getElementById("getDataLabel");
        other_dataLabel.textContent = "Get data";
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
            bar_mode: 0,
            revision: 999,
            range_start: 0,
            range_end: 0,
            hue_start: 0,
            hue_end: 0,
            saturation: 0,
            c_value: 0,
            backlight_value: 0,
            backlight_saturation: 0,
            backlight_hue: 0,
            color_pos1: 0,
            color_pos2:  0,
            color_pos3:  0,
            color_hues_fill1:  0,
            color_hues_fill2:  0,
            color_hues_fill3:  0,
            color_hues_fill4:  0,
        };

        if (connectionState === DISCONNECTED) {
            connectionState = CONNECTING;
            error = null;
            if (!settings._modbus)
            {
                stmApi
                .connect({
                    replyMode: settings.replyMode,
                    baudrate: settings.baudrate,
                    mcutype: settings.mcuType,
                    modbus: false
                })
                .then(() => {
                    connectionState = CONNECTED;
                    return stmApi.cmdGET();
                })
                .then((info) => {
                    deviceInfo.bl = info.blVersion;
                    deviceInfo.commands = info.commands;
                    deviceInfo.family = info.getFamily();
                    if (deviceInfo.family === 'STM32') {
                        //deviceInfo.family = '32-bit'
                        return stmApi.cmdGID();
                    } else {
                        return Promise.resolve('-');
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
                    var hexString = "0x" + Array.from(data, byte => ('0' + byte.toString(16)).slice(-2)).join('');
                    deviceInfo.serial_num = hexString;
                    return Promise.resolve();
                })
                .then(() => 
                {
                    console.log(checkGeniune(deviceInfo.serial_num) ? "Device IS geniune" : "Device IS NOT geniune");
                    log("Modbus not enabled");
                    if (!checkGeniune(deviceInfo.serial_num))
                        log("Someone is cheating! Functions are limited, write your own software!");
                })
                .catch((err) => {
                    log(err);
                    console.log(err);
                    if (err!=undefined)
                    {
                        error = err.message;    
                    }
                    //TODO if connected to port disconnect
                    connectionState = DISCONNECTED;
                });
            }
            else
            {
                //Modbus active
                stmApi
                .connect({
                    replyMode: settings.replyMode,
                    baudrate: settings.baudrate,
                    mcutype: settings.mcuType,
                    modbus: false
                })
                .then(() => {
                    connectionState = CONNECTED;
                    return stmApi.cmdGET();
                })
                .then((info) => {
                    deviceInfo.bl = info.blVersion;
                    deviceInfo.commands = info.commands;
                    deviceInfo.family = info.getFamily();
                    if (deviceInfo.family === 'STM32') {
                        //deviceInfo.family = '32-bit'
                        return stmApi.cmdGID();
                    } else {
                        return Promise.resolve('-');
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
                    console.log("Response");
                    console.log(data);
                    var hexString = "0x" + Array.from(data, byte => ('0' + byte.toString(16)).slice(-2)).join('');
                    console.log(hexString);
                    deviceInfo.serial_num = hexString;
                    return Promise.resolve();
                })
                .then(() => 
                {
                    console.log(checkGeniune(deviceInfo.serial_num) ? "Device IS geniune" : "Device IS NOT geniune");
                    log("Modbus not enabled");
                })
                .then(() => 
                {
                    //Now disconnect
                    return stmApi.disconnect();
                })
                .then(() => 
                {
                    connectionState = DISCONNECTED;
                    //Now connect to modbus
                    return stmApi.connect({
                        replyMode: settings.replyMode,
                        baudrate: settings.baudrate,
                        mcutype: settings.mcuType,
                        modbus: true
                    })
                })
                .then(() => {
                    connectionState = CONNECTED;
                    return stmApi.cmdGET();
                })
                .then((info) => {
                    deviceInfo.bl = info.blVersion;
                    deviceInfo.commands = info.commands;
                    deviceInfo.family = "IV";
                    deviceInfo.inp0 = info.inp0/1000;
                    deviceInfo.inp1 = info.inp1/1000;
                    deviceInfo.revision = info.revision;
                    deviceInfo.temperature = info.temperature;
                    return Promise.resolve('IV Modbus');
                })
                .then((pid) => {
                    deviceInfo.pid = pid;
                    updateCaptions();
                })
                .then(() => 
                {
                    console.log(checkGeniune(deviceInfo.serial_num) ? "Device IS geniune" : "Device IS NOT geniune");
                    if (!checkGeniune(deviceInfo.serial_num))
                        log("Someone is cheating! Functions are limited, write your own software!");
                    log("Modbus enabled");
                })
                .catch((err) => {
                    log(err);
                    console.log(err);
                    if (err!=undefined)
                    {
                        error = err.message;    
                    }
                    //TODO if connected to port -disconnect
                    connectionState = DISCONNECTED;
                });
            }
            
        } else {
            stmApi.disconnect().catch((err) => {
                // if (stmApi.serial.isOpen()) {
                //     stmApi.serial.close(function (err) {
                //         console.log('port closed', err);
                //     });
                // }
                if (err!=undefined)
                {
                    error = err.message;    
                }
                console.log(err)
            });
        }
    }

    function onConnectBoot()
    {
        
        settings._modbus = false;
        onConnect();
    }

    function onConnectMODBUS()
    {
        settings._modbus = true;
        onConnect();
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

    function onBarModeSelect(event) {
        let value = event.target.value;
        if ((value=="1")||(value==1))
            deviceInfo.bar_mode|=1;
        else
            deviceInfo.bar_mode&=~1;
        console.log(value);
        console.log(deviceInfo.bar_mode);
        updateSliderValue(sliderBarMode,deviceInfo.bar_mode);
        updateSliders();
    }

    function onSegmentsModeSelect(event) {
        let value = event.target.value;
        if ((value=="1")||(value==1))
            deviceInfo.bar_mode|=2;
        else
            deviceInfo.bar_mode&=~2;

        if ((value=="2")||(value==2))
            deviceInfo.bar_mode|=4;
        else
            deviceInfo.bar_mode&=~4;
        console.log(value);
        console.log(deviceInfo.bar_mode);
        updateSliderValue(sliderBarMode,deviceInfo.bar_mode);
        updateSliders();
    }

    function loadPreset(value)
    {
        // Iterate through presetsData to find the element with the predefined name
        const foundPreset = presetsData.find(preset => preset.name === value);
        // Check if the element with the predefined name is found
        if (foundPreset) {
            // Assign corresponding fields of deviceInfo based on the found preset
            deviceInfo.source = foundPreset.source&0xFF;
            deviceInfo.bar_mode = (foundPreset.source&0xFF00)>>8;
            deviceInfo.range_start = foundPreset.range_start;
            deviceInfo.range_end = foundPreset.range_end;
            deviceInfo.hue_start = foundPreset.hue_start;
            deviceInfo.hue_end = foundPreset.hue_end;
            deviceInfo.saturation = foundPreset.saturation;
            deviceInfo.c_value = foundPreset.c_value;
            deviceInfo.backlight_value = foundPreset.backlight_value;
            deviceInfo.backlight_saturation = foundPreset.backlight_saturation;
            deviceInfo.backlight_hue = foundPreset.backlight_hue;
            try {
                deviceInfo.color_hues_fill1 = foundPreset.color_hues_fill1;
                deviceInfo.color_hues_fill2 = foundPreset.color_hues_fill2;
                deviceInfo.color_hues_fill3 = foundPreset.color_hues_fill3;
                deviceInfo.color_hues_fill4 = foundPreset.color_hues_fill4;
                deviceInfo.color_pos1 = foundPreset.color_pos1;
                deviceInfo.color_pos2 = foundPreset.color_pos2;
                deviceInfo.color_pos3 = foundPreset.color_pos3;
            } catch (error) {
                console.log(error);
            }
        } else {
            console.log(`Preset with name "${predefinedName}" not found.`);
        }
    }

    selectTypePreset = (value) => {
        updateSliderValue(sliderSource,deviceInfo.source);
        updateSliderValue(sliderBarMode,deviceInfo.bar_mode);
        updateSliderValue(sliderRangeMin,deviceInfo.range_start);
        updateSliderValue(sliderRangeMax,deviceInfo.range_end);
        updateSliderValue(sliderHStart,deviceInfo.hue_start);
        updateSliderValue(sliderHEnd,deviceInfo.hue_end);
        updateSliderValue(sliderS,deviceInfo.saturation);
        updateSliderValue(sliderV,deviceInfo.c_value);
        updateSliderValue(sliderHBl,deviceInfo.backlight_hue);
        updateSliderValue(sliderSBl,deviceInfo.backlight_saturation);
        updateSliderValue(sliderVBl,deviceInfo.backlight_value);
        updateSliderValue(sliderH1,deviceInfo.color_hues_fill1);
        updateSliderValue(sliderH2,deviceInfo.color_hues_fill2);
        updateSliderValue(sliderH3,deviceInfo.color_hues_fill3);
        updateSliderValue(sliderH4,deviceInfo.color_hues_fill4);
        updateSliderValue(sliderH1Pos,deviceInfo.color_pos1);
        updateSliderValue(sliderH2Pos,deviceInfo.color_pos2);
        updateSliderValue(sliderH3Pos,deviceInfo.color_pos3);

        if (value=="vmeter")
        {
            deviceInfo.source = 0;
            deviceInfo.bar_mode = 1;
            deviceInfo.range_start = 9500;
            deviceInfo.range_end = 15500;
            deviceInfo.hue_start = 15;
            deviceInfo.hue_end = 56;
            deviceInfo.saturation = 219;
            deviceInfo.c_value = 3;
            deviceInfo.backlight_hue = 28;
            deviceInfo.backlight_saturation = 255;
            deviceInfo.backlight_value = 1;
        }
        else if (value=="tmeter")
        {
            deviceInfo.source = 0;
            deviceInfo.bar_mode = 1;
            deviceInfo.range_start = 0;
            deviceInfo.range_end = 4500;
            deviceInfo.hue_start = 15;
            deviceInfo.hue_end = 128;
            deviceInfo.saturation = 219;
            deviceInfo.c_value = 3;
            deviceInfo.backlight_hue = 28;
            deviceInfo.backlight_saturation = 255;
            deviceInfo.backlight_value = 1;
        }
        else if (value=="pmeter")
        {
            deviceInfo.source = 0;
            deviceInfo.bar_mode = 1;
            deviceInfo.range_start = 500;
            deviceInfo.range_end = 4500;
            deviceInfo.hue_start = 15;
            deviceInfo.hue_end = 128;
            deviceInfo.saturation = 219;
            deviceInfo.c_value = 3;
            deviceInfo.backlight_hue = 28;
            deviceInfo.backlight_saturation = 255;
            deviceInfo.backlight_value = 1;
        }
        else
        {
            loadPreset(value);
        }
        updateSliders();
    }

    function onTypeSelect(event) {
        let value = event.target.value;
        selectTypePreset(value);
    }

    function updateSliderValue(sl,val)
    {
        sl.value=val;
    }

    function updateSliders()
    {
        updateSliderValue(sliderSource,deviceInfo.source);
        updateSliderValue(sliderBarMode,deviceInfo.bar_mode);
        updateSliderValue(sliderRangeMin,deviceInfo.range_start);
        updateSliderValue(sliderRangeMax,deviceInfo.range_end);
        updateSliderValue(sliderHStart,deviceInfo.hue_start);
        updateSliderValue(sliderHEnd,deviceInfo.hue_end);
        updateSliderValue(sliderS,deviceInfo.saturation);
        updateSliderValue(sliderV,deviceInfo.c_value);
        updateSliderValue(sliderHBl,deviceInfo.backlight_hue);
        updateSliderValue(sliderSBl,deviceInfo.backlight_saturation);
        updateSliderValue(sliderVBl,deviceInfo.backlight_value);
        updateSliderValue(sliderH1, deviceInfo.color_hues_fill1);
        updateSliderValue(sliderH2, deviceInfo.color_hues_fill2);
        updateSliderValue(sliderH3, deviceInfo.color_hues_fill3);
        updateSliderValue(sliderH4, deviceInfo.color_hues_fill4);
        updateSliderValue(sliderH1Pos, deviceInfo.color_pos1);
        updateSliderValue(sliderH2Pos, deviceInfo.color_pos2);
        updateSliderValue(sliderH3Pos, deviceInfo.color_pos3);
        updateCaptions();
    }

    function updateCaptions()
    {   
        updateSliderOutput(sliderBarModeOut,sliderBarMode,"Bar mode: ");
        updateSliderOutput(sliderSourceOut,sliderSource,"Source: ");
        updateSliderOutput(sliderRangeMinOut,sliderRangeMin,"Range Min(V): ");
        updateSliderOutput(sliderRangeMaxOut,sliderRangeMax,"Range Max(V): ");
        updateSliderOutput(sliderHStartOut,sliderHStart,"Hue Start: ");
        updateSliderOutput(sliderH1Out,sliderH1,"Hue1: ");
        updateSliderOutput(sliderH2Out,sliderH2,"Hue2: ");
        updateSliderOutput(sliderH3Out,sliderH3,"Hue3: ");
        updateSliderOutput(sliderH4Out,sliderH4,"Hue4: ");
        updateSliderOutput(sliderH1PosOut,sliderH1Pos,"H1Pos: ");
        updateSliderOutput(sliderH2PosOut,sliderH2Pos,"H2Pos: ");
        updateSliderOutput(sliderH3PosOut,sliderH3Pos,"H3Pos: ");
        updateSliderOutput(sliderHEndOut,sliderHEnd,"Hue End: ");
        updateSliderOutput(sliderSOut,sliderS,"C.Sat: ");
        updateSliderOutput(sliderVOut,sliderV,"C.Val: ");
        updateSliderOutput(sliderHBlOut,sliderHBl,"Bl.C.Hue: ");
        updateSliderOutput(sliderSBlOut,sliderSBl,"Bl.C.Sat: ");
        updateSliderOutput(sliderVBlOut,sliderVBl,"Bl.C.Val: ");
        // Set color for hue labels
        deviceInfo.bar_mode = sliderBarMode.value*1;
        sliderH1Out.style.color = getHueColor(sliderH1.value);
        sliderH2Out.style.color = getHueColor(sliderH2.value);
        sliderH3Out.style.color = getHueColor(sliderH3.value);
        sliderH4Out.style.color = getHueColor(sliderH4.value);
        sliderHStartOut.style.color = getHueColor(sliderHStart.value);
        sliderHEndOut.style.color = getHueColor(sliderHEnd.value);
        sliderHBlOut.style.color = getHueColor(sliderHBl.value);
    }

    function updateSliderOutput(el,sl,txt)
    {
        el.textContent = txt + sl.value;
    }

    onMount(() => {
    // Get the slider and output elements
    fetchGeniuneIDs();
    fetchIndicatorPresets();

    sliderBarMode = document.getElementById('sliderBarMode');
    sliderBarModeOut = document.querySelector('output[for="sliderBarMode"]');

    sliderSource = document.getElementById('sliderSource');
    sliderSourceOut = document.querySelector('output[for="sliderSource"]');

    sliderRangeMin = document.getElementById('sliderRangeMin');
    sliderRangeMinOut = document.querySelector('output[for="sliderRangeMin"]');

    sliderRangeMax = document.getElementById('sliderRangeMax');
    sliderRangeMaxOut = document.querySelector('output[for="sliderRangeMax"]');

    sliderHStart = document.getElementById('sliderHStart');
    sliderHStartOut = document.querySelector('output[for="sliderHStart"]');

    sliderH1 = document.getElementById('sliderH1');
    sliderH1Out = document.querySelector('output[for="sliderH1"]');

    sliderH2 = document.getElementById('sliderH2');
    sliderH2Out = document.querySelector('output[for="sliderH2"]');

    sliderH3 = document.getElementById('sliderH3');
    sliderH3Out = document.querySelector('output[for="sliderH3"]');

    sliderH4 = document.getElementById('sliderH4');
    sliderH4Out = document.querySelector('output[for="sliderH4"]');

    sliderH1Pos = document.getElementById('sliderH1Pos');
    sliderH1PosOut = document.querySelector('output[for="sliderH1Pos"]');

    sliderH2Pos = document.getElementById('sliderH2Pos');
    sliderH2PosOut = document.querySelector('output[for="sliderH2Pos"]');

    sliderH3Pos = document.getElementById('sliderH3Pos');
    sliderH3PosOut = document.querySelector('output[for="sliderH3Pos"]');

    sliderHEnd = document.getElementById('sliderHEnd');
    sliderHEndOut = document.querySelector('output[for="sliderHEnd"]');

    sliderS = document.getElementById('sliderS');
    sliderSOut = document.querySelector('output[for="sliderS"]');

    sliderV = document.getElementById('sliderV');
    sliderVOut = document.querySelector('output[for="sliderV"]');

    sliderHBl = document.getElementById('sliderHBl');
    sliderHBlOut = document.querySelector('output[for="sliderHBl"]');

    sliderSBl = document.getElementById('sliderSBl');
    sliderSBlOut = document.querySelector('output[for="sliderSBl"]');

    sliderVBl = document.getElementById('sliderVBl');
    sliderVBlOut = document.querySelector('output[for="sliderVBl"]');

    // Select all slider elements with the class 'slider'
    const sliders = document.querySelectorAll('.slider');
    // Attach the 'input' event listener to each slider
    sliders.forEach((slider) => {
        slider.addEventListener('input', updateCaptions);
    });

    if (presetsData.length>0)
    {
        loadPreset(presetsData[0]);
    }

    updateSliders();
    updateCaptions();

    setInterval(modbusGetDataTimer, 1000);
    setInterval(modbusSetParameters,500);
    }
    );

    $: isConnected = connectionState === CONNECTED;
    $: isConnecting = connectionState === CONNECTING;
    $: isDisconnected = connectionState === DISCONNECTED;
    $: isGeniune = checkGeniune(deviceInfo.serial_num)
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
    .slider {
        --slider-track-background: 0;
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
                    class:is-hidden={isConnected || isConnecting || (selectedPort==null)}
                    on:click={onConnectBoot}>
                    <span class="icon"><i
                            class="fa {isConnected ? 'fa-unlink' : 'fa-link'}" /></span>
                    <span>Connect Boot</span>
                </a>
                <a
                    class="navbar-item"
                    class:is-hidden={isConnected || isConnecting || (selectedPort==null)}
                    on:click={onConnectMODBUS}>
                    <span class="icon"><i
                            class="fa {isConnected ? 'fa-unlink' : 'fa-link'}" /></span>
                    <span>Connect MODBUS</span>
                </a>
                <a
                    class="navbar-item"
                    class:is-hidden={!isConnected || isConnecting || (selectedPort==null)}
                    class:disabled={isConnecting || isConnecting || (selectedPort==null)}
                    on:click={onConnect}>
                    <span class="icon"><i
                            class="fa fa-unlink" /></span>
                    <span>Disconnect</span>
                </a>
                <a
                    class="navbar-item"
                    class:is-hidden={!isGeniune || !cmdsAllowed || settings._modbus}
                    on:click={onErase}>
                    <span class="icon"><i class="fa fa-eraser" /></span>
                    <span>Full Erase</span>
                </a>
                <a
                    class="navbar-item"
                    class:is-hidden={!isGeniune || !selectedFile || !cmdsAllowed || settings._modbus}
                    on:click={() => onFlash(false)}>
                    <span class="icon"><i class="fas fa-pen" /></span>
                    <span>Flash</span>
                </a>
                <a
                    class="navbar-item"
                    class:is-hidden={!isGeniune || !selectedFile || !cmdsAllowed || settings._modbus}
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
                    class:is-hidden={!isGeniune || !settings._modbus || !isConnected}
                    on:click={() => onToggleGetData()}>
                    <span class="icon"><i class="fa fa-car" /></span>
                    <span id="getDataLabel">Get data</span>
                </a>
                <a
                    class="navbar-item"
                    class:is-hidden={!isGeniune || !settings._modbus || !isConnected}
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
            <div class="column" style="min-width: 360px;">
                <div class="box">
                    <p class="title is-5">Log Messages</p>
                    <pre>{logs}</pre>
                </div>
            </div>
            <div class="column " style="min-width: 360px;">
                <div class="box" id="devinfo">
                    <p class="title is-5">Setup</p>
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">Device:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="select">
                                    <select id="dType" on:change={onTypeSelect} >
                                    </select>
                                </div>
                            </div>
                        </div>
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
                                <div class="label">Bar mode:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="select">
                                    <select
                                        id="barModeSelect"
                                        on:change={onBarModeSelect}>
                                        <option value="0" selected>Dot mode</option>
                                        <option value="1" >Bar mode</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="label">Segments mode:</div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="select">
                                    <select
                                        id="segmentsModeSelect"
                                        on:change={onSegmentsModeSelect}>
                                        <option value="0" selected>Gradient</option>
                                        <option value="1" >4-segments</option>
                                        <option value="2" >Color by value</option>
                                    </select>
                                </div>
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
                                <output class="label" for="sliderSource" id="sliderSourceTooltip">0</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderSource" class="slider" min="0" max="255" value="0" step="1" type="range">
                            </div>
                        </div>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderBarMode" id="sliderBarModeTooltip">0</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderBarMode" class="slider" min="0" max="255" value="0" step="1" type="range">
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
                                <input id="sliderRangeMin" class="slider" min="0" max="12000" value="9500" step="100" type="range">
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
                                <input id="sliderRangeMax" class="slider" min="0" max="30000" value="15500" step="100" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile" class:is-hidden={(deviceInfo.bar_mode&2)}>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderHStart" id="sliderHStartTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderHStart" class="slider" style="--slider-track-color=blue" min="0" max="255" value="15" step="1" type="range">
                            </div>  
                        </div>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderHEnd" id="sliderHEndTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderHEnd" class="slider" min="0" max="255" value="56" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile" class:is-hidden={!(deviceInfo.bar_mode&2)}>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderH1" id="sliderH1Tooltip"></output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderH1" class="slider" style="--slider-track-color=blue" min="0" max="255" value="15" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile" class:is-hidden={!(deviceInfo.bar_mode&2)}>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderH2" id="sliderH2Tooltip"></output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderH2" class="slider" style="--slider-track-color=blue" min="0" max="255" value="15" step="1" type="range">
                            </div>  
                        </div>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderH1Pos" id="sliderH1PosTooltip"></output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderH1Pos" class="slider" style="--slider-track-color=blue" min="0" max="15" value="2" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile" class:is-hidden={!(deviceInfo.bar_mode&2)}>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderH3" id="sliderH3Tooltip"></output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderH3" class="slider" style="--slider-track-color=blue" min="0" max="255" value="15" step="1" type="range">
                            </div>  
                        </div>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderH2Pos" id="sliderH2PosTooltip"></output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderH2Pos" class="slider" style="--slider-track-color=blue" min="0" max="15" value="2" step="1" type="range">
                            </div>  
                        </div>
                    </div>

                    <div class="level is-mobile" class:is-hidden={!(deviceInfo.bar_mode&2)}>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderH4" id="sliderH4PosTooltip"></output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderH4" class="slider" style="--slider-track-color=blue" min="0" max="255" value="15" step="1" type="range">
                            </div>  
                        </div>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderH3Pos" id="sliderH3Tooltip"></output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderH3Pos" class="slider" style="--slider-track-color=blue" min="0" max="15" value="2" step="1" type="range">
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
                                <input id="sliderS" class="slider" min="0" max="255" value="219" step="1" type="range">
                            </div>  
                        </div>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderV" id="sliderVTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderV" class="slider" min="0" max="255" value="3" step="1" type="range">
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
                                <input id="sliderHBl" class="slider" min="0" max="255" value="28" step="1" type="range">
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
                                <input id="sliderSBl" class="slider" min="0" max="255" value="255" step="1" type="range">
                            </div>  
                        </div>
                        <div class="level-left">
                            <div class="level-item">
                                <output class="label" for="sliderVBl" id="sliderVBlTooltip">50</output>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <input id="sliderVBl" class="slider" min="0" max="255" value="1" step="1" type="range">
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