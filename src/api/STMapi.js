import tools from '../tools';
import logger from './Logger';
import settings from './Settings';

const MAX_WRITE_BLOCK_SIZE_STM32 = 256;
const MAX_READ_BLOCK_SIZE = 256;
const MAX_WRITE_BLOCK_SIZE_STM8 = 128;

// use control signals to trigger bootloader activation and device hardware reset
// false = pin hight, true = pin low
const RTS_PIN = "requestToSend";
const DTR_PIN = "dataTerminalReady"; // STM32
const PIN_HIGH = false;
const PIN_LOW = true;

const SYNCHR = 0x7F;
const SYNCHR_ARTERY = 0x7F; //Set host identification number

const ACK = 0x79;
const NACK = 0x1F;

const CMD_GET = 0x00;
const CMD_GV = 0x01;
// GET ID command used to identify the STM family. If it's present it's STM32, STM8 otherwise
const CMD_GID = 0x02;
const CMD_READ = 0x11;
const CMD_GO = 0x21;
const CMD_WRITE = 0x31;
const CMD_ERASE = 0x43;
const CMD_EXTENDED_ERASE = 0x44;
const CMD_WPUN = 0x73;
const CMD_RDU_PRM = 0x92;

// Address for erase_write_routines for STM8 S/A
const STM8_WRITE_CODE_ADDRESS = 0xA0;

const EwrLoadState = Object.freeze({
    NOT_LOADED: Symbol("not_loaded"),
    LOADING: Symbol("loading"),
    LOADED: Symbol("loaded")
});

function u8a(array) {
    return new Uint8Array(array);
}

function CRC16_2(buf) {
    let crc = 0xFFFF;
  
    for (let pos = 0; pos < buf.length; pos++) {
      crc ^= buf[pos] & 0xFF; // XOR byte into the least significant byte of crc
  
      for (let i = 8; i !== 0; i--) {
        // Loop over each bit
        if ((crc & 0x0001) !== 0) {
          // If the LSB is set
          crc = (crc >> 1) ^ 0xA001; // Shift right and XOR 0xA001
        } else {
          // Else LSB is not set
          crc >>= 1; // Just shift right
        }
      }
    }
  
    // Note: This number has low and high bytes swapped, so use it accordingly (or swap bytes)
    return crc;
  }

export class InfoGV {
    constructor() {
        // Bootloader version
        this.blVersion = null;
        // Number of times the read protection was disabled
        this.countRPdisabled = -1;
        // Number of times the read protection was enabled
        this.countRPenabled = -1;
    }
}

export class InfoGET {
    constructor() {
        // Bootloader version
        this.blVersion = null;
        // List of supported commands
        this.commands = [];
        this.inp0 = 0.0;
        this.inp1 = 0.0;
        this.source = 0;
        this.bar_mode = 0;
        this.range_min = 0.0;
        this.range_max = 0.0;
        this.revision = 0;
        this.temperature = 999.0;
        this.range_start = 0;
        this.range_end= 0;
        this.hue_start= 0;
        this.hue_end= 0;
        this.saturation= 0;
        this.c_value= 0;
        this.backlight_value = 0;
        this.backlight_saturation = 0;
        this.backlight_hue = 0;
        this.data_valid = 0;
        this.color_pos1 = 0;
        this.color_pos2 = 0;
        this.color_pos3 = 0;
        this.color_hues_fill1 = 0;
        this.color_hues_fill2 = 0;
        this.color_hues_fill3 = 0;
        this.color_hues_fill4 = 0;
        this.beta_coefficient=  4000;
        this.nominal_resistance= 1000;
    }

    getFamily() {
        return this.commands.indexOf(CMD_GID) === -1 ? 'STM8' : 'STM32';
    }
}

export class STMApi {
    constructor(serial) {
        if (!serial) {
            throw new Error('Serial port object not provided');
        }
        this.serial = serial;
        // reply mode which is necessary for some STM8 MCUs
        this.replyMode = false;
        // Indicates if the STM8 erase_write_routines are already loaded
        this.ewrLoadState = EwrLoadState.NOT_LOADED;
        // max: STM8 = 128, STM32 = 256. must be mutliple of 4
        this.writeBlockSize = MAX_WRITE_BLOCK_SIZE_STM8;
        this.readBlockSize = MAX_READ_BLOCK_SIZE;
        // list of supported commands by the target
        this.commands = [];
        // name of the stm8 routines file
        this.stm8RoutinesFile = null;
        //Access MODBUS and not Bootloader
        this.modbusEnabled = false;
    }

    /**
     * Initializes erase_write_routines for STM8 S/A
     * @param {flash:"0"|"32"|"128"|"256", blVersion:string} device Flash size of the target MCU
     */
    setDevice(device) {
        this.ewrLoadState = EwrLoadState.NOT_LOADED;

        if (!device.blVersion || !device.flash) {
            return;
        }

        if (device.flash === '0') { // STM8 L
            this.ewrLoadState = EwrLoadState.LOADED;
            return;
        } else if (device.flash !== '32' && device.flash !== '128' && device.flash !== '256') {
            throw new Error('Unsupported device selected: ' + device);
        }

        this.stm8RoutinesFile = 'res/stm8_routines/E_W_ROUTINEs_' + device.flash + 'K_ver_' + device.blVersion + '.bin';
    }

    /**
     * Connect to the target by resetting it and activating the ROM bootloader
     * @param {object} params
     * @returns {Promise}
     */
    async connect(params) {
        this.ewrLoadState = EwrLoadState.NOT_LOADED;
        return new Promise((resolve, reject) => {
            logger.log('Connecting with baudrate ' + params.baudrate + ' and reply mode ' + (params.replyMode ? 'on' : 'off'));
            if (this.serial.isOpen()) {
                reject(new Error('Port already opened'));
                return;
            }

            this.replyMode = params.replyMode || false;
            this.modbusEnabled = params.modbus || false;
            this.serial.open({
                baudRate: parseInt(params.baudrate, 10),
                parity: (this.replyMode||this.modbusEnabled) ? 'none' : 'even'
            })
                .then(() => {
                    // set init state of the NRST pin to high
                    // for stm32 set the BOOT0 pin to low.
                    let signal = {}
                    signal[RTS_PIN] = PIN_HIGH; //RESET=1
                    signal[DTR_PIN] = PIN_LOW; //BOOT0=0
                    return this.serial.control(signal);
                    
                })
                .then(() => this.activateBootloader())
                .then(() => this.delay_nb(500))
                .then(resolve)
                .catch(error => {
                    if (this.serial.isOpen()) {
                        this.serial.close(function (err) {
                            console.log('port closed', err);
                        });
                    }
                    reject(error);
                })
        });
    }

    /**
     * Close current connection. Before closing serial connection disable bootloader and reset target
     * @returns {Promise}
     */
    async disconnect() {
        try {
            await this.serial.control({ [DTR_PIN]: PIN_LOW, [RTS_PIN]: PIN_HIGH });
            await this.resetTarget();
            await this.serial.close(); // use await
        } catch (e) {
            logger.log('Disconnect error:', e);
            throw e;
        }
    }

    /**
     * Write data to memory. If the data exceeds the max frame size it will be splitted and sent in chunks automatically
     * @param {Uint8Array} data Data to write
     * @param {number} address Address to write at
     * @param {Function} onProgress Callback to notify progress
     * @returns {Promise}
     */
    async write(data, address, onProgress) {
        return new Promise(async (resolve, reject) => {
            logger.log('Writing ' + data.length + ' bytes to flash at address 0x' + address.toString(16) + ' using ' + this.writeBlockSize + ' bytes chunks');
            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            let blocksCount = Math.ceil(data.byteLength / this.writeBlockSize);

            let offset = 0;
            let blocks = [];
            for (let i = 0; i < blocksCount; i++) {
                let block = {};

                if (i < blocksCount - 1) {
                    block.data = data.subarray(offset, offset + this.writeBlockSize);
                } else {
                    block.data = data.subarray(offset);
                }
                offset += block.data.length;
                blocks.push(block);
            }

            for (let i = 0; i < blocks.length; i++) {
                let block = blocks[i];
                try {
                    //logger.log('Writing block ' + (i + 1) + '/' + blocksCount);
                    if (onProgress) {
                        onProgress(i, blocksCount);
                    }
                    await this.cmdWRITE(block.data, address + i * this.writeBlockSize);
                } catch (e) {
                    reject(e);
                    return;
                }
            }
            logger.log('Finished writing');
            resolve();
        });
    }

    /**
     * Do a full erase of the flash
     * @returns {Promise}
     */
    async eraseAll() {
        return new Promise(async (resolve, reject) => {
            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            if (!this.commands.length) {
                reject(new Error('Execute GET command first'));
                return;
            }

            if (this.ewrLoadState == EwrLoadState.NOT_LOADED) {
                try {
                    await this.sendEWR();
                } catch (e) {
                    reject(e);
                    return;
                }
            }

            let eraseCmd, eraseFlash;
            if (this.commands.indexOf(CMD_ERASE) !== -1) {
                eraseCmd = [CMD_ERASE, 0xFF ^ CMD_ERASE];
                eraseFlash = [0xFF, 0x00];
            } else if (this.commands.indexOf(CMD_EXTENDED_ERASE) !== -1) {
                eraseCmd = [CMD_EXTENDED_ERASE, 0xFF ^ CMD_EXTENDED_ERASE];
                eraseFlash = [0xFF, 0xFF, 0x00];
            } else {
                reject(new Error('No erase command found'));
                return;
            }

            this.serial.write(u8a(eraseCmd))
                .then(() => this.readResponse())
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK erase ALL');
                    }
                    return this.serial.write(u8a(eraseFlash));
                })
                .then(() => this.readResponse())
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while erase ALL');
                    }
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Async delay
     * @param {*} ms 
     * @returns 
     */
    async delay_nb(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * sets modbus parameter
     * @param {*} reg 
     * @param {*} val 
     * @returns 
     */
    async cmdModbusWRITEReg(reg,val) {
        return new Promise((resolve, reject) => {
            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }
            if (this.modbusEnabled)
            {
                var modbusRequest = u8a([0x01,0x06,(reg&0xFF00)>>8,(reg&0xFF),(val&0xFF00)>>8,(val&0xFF)]);
                var checksum = CRC16_2(modbusRequest);
                var ch8a = u8a([checksum&0xFF,(checksum&0xFF00)>>8]);
                const combinedArray = new Uint8Array(modbusRequest.length + ch8a.length);
                combinedArray.set(modbusRequest, 0);
                combinedArray.set(ch8a, modbusRequest.length);
                console.log(combinedArray);
                this.serial.write(combinedArray).then(()=>resolve());
            }
        });
    }

    /**
     * Executes GET command
     * @returns {Promise<InfoGET>}
     */
    async cmdGET() {
        return new Promise((resolve, reject) => {
            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            if (this.modbusEnabled)
            {
                //01 03 00 00 00 0D 84 0F

                var parNumber = 35;
                var modbusRequest = u8a([0x01,0x03,0x00,0x00,0x00,parNumber]);
                var checksum = CRC16_2(modbusRequest);
                var ch8a = u8a([checksum&0xFF,(checksum&0xFF00)>>8]);
                var expectedLength = this.calculateModbusResponseSize(3,parNumber);
                const combinedArray = new Uint8Array(modbusRequest.length + ch8a.length);
                combinedArray.set(modbusRequest, 0);
                combinedArray.set(ch8a, modbusRequest.length);
                console.log(combinedArray);
                this.serial.write(combinedArray)
                .then(() => this.readResponseWithTimeout(expectedLength,1000))
                .then(async (resp) => {
                    let response = new Uint8Array(resp);
                    
                    console.log(resp);
                    let info = new InfoGET();

                    // Exclude the last two bytes
                    const dataToCheck = response.subarray(0, response.length - 2);

                    // Calculate CRC16_2 on the remaining data
                    const calculatedCRC = CRC16_2(dataToCheck);

                    // Get the last two bytes
                    const lastTwoBytes = response.subarray(response.length - 2);
                    // Check if the calculated CRC matches the last two bytes
                    const isCRCValid = calculatedCRC === (lastTwoBytes[0] + (lastTwoBytes[1] << 8));
                    console.log(isCRCValid);
                    if (isCRCValid)
                    {
                        // 01 03 1A 00 04 FE F9 03 32 03 14 FF FF FF FF 11 B6 11 0F FF FF FF FF 00 00 03 E8 13 88 C6 3B (31 bytes)
                        info.blVersion = (response[2] >> 4) + '.' + (response[2] & 0x0F);
                        info.revision = (response[3] << 8) | (response[4] );
                        info.temperature = (response[5] << 8) | (response[6] );
                        info.inp0 = (response[15] << 8) | (response[16] );
                        info.inp1 = (response[17] << 8) | (response[18] );
                        info.source = (response[24]);
                        info.bar_mode = (response[23]);
                        info.range_min = (response[25] << 8) | (response[26] );
                        info.range_max = (response[27] << 8) | (response[28] );
                        info.c_value = (response[33] << 8) | (response[34] );
                        info.saturation = (response[35] << 8) | (response[36] );
                        info.hue_start = (response[37] << 8) | (response[38] );
                        info.hue_end = (response[39] << 8) | (response[40] );
                        info.color_pos1 = response[42]&0xf;
                        info.color_pos2 = (response[42]&0xf0)>>4;
                        info.color_pos3 = response[41]&0xf;
                        info.backlight_value = (response[43] << 8) | (response[44] );
                        info.backlight_saturation = (response[45] << 8) | (response[46] );
                        info.backlight_hue = (response[47] << 8) | (response[48] );
                        info.color_hues_fill1 = response[49];
                        info.color_hues_fill2 = response[50];
                        info.color_hues_fill3 = response[51];
                        info.color_hues_fill4 = response[52];
                        info.nominal_resistance = (response[65] << 8) | (response[66] );
                        info.beta_coefficient = (response[67] << 8) | (response[68] );
                        
                        info.data_valid = 1;
                        console.log(info)
                    }
                    resolve(info);
                })
                .catch(reject);
            }
            else
            {
                this.serial.write(u8a([CMD_GET, 0xFF ^ CMD_GET]))
                .then(() => this.readResponse())
                .then(async (resp) => {
                    let response = new Uint8Array(resp);
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK cmdGET');
                    }

                    // if (response.length === 1) { // TODO stm8 sends the bytes with delay. Always or on in reply mode only?
                    //     let res = await this.readResponse();
                    //     response[1] = res[0];
                    //     res = await this.readResponse(); // bl version
                    //     response[2] = res[0];
                    //     for (let i = 0; i <= response[1]; i++) {
                    //         res = await this.readResponse();
                    //         response[3 + i] = res[0];
                    //     }
                    // }

                    while (response.length === 1 || response.length < response[1] + 4) {
                        let res = await this.readResponse();
                        response = new Uint8Array([
                            ...response,
                            ...res
                        ]);
                    }

                    let info = new InfoGET();
                    info.blVersion = (response[2] >> 4) + '.' + (response[2] & 0x0F);
                    for (let i = 0; i < response[1]; i++) {
                        info.commands.push(response[3 + i]);
                    }
                    this.commands = info.commands;
                    if (info.getFamily() === 'STM32') {
                        this.writeBlockSize = MAX_WRITE_BLOCK_SIZE_STM32;
                        this.ewrLoadState = EwrLoadState.LOADED;
                    } else {
                        this.writeBlockSize = MAX_WRITE_BLOCK_SIZE_STM8;
                    }
                    resolve(info);
                })
                .catch(reject);
            }
        });
    }

    /**
     * Execute GO command
     * @param {number} address Memory address to start code execution
     * @returns {Promise}
     */
    async cmdGO(address) {
        return new Promise((resolve, reject) => {
            let addressFrame;

            if (!Number.isInteger(address)) {
                reject(new Error('Invalid address parameter'));
                return;
            }

            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            addressFrame = tools.num2a(address, 4);
            addressFrame.push(this.calcChecksum(addressFrame, false));

            this.serial.write(u8a([CMD_GO, 0xFF ^ CMD_GO]))
                .then(() => this.readResponse())
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK CMD GO');
                    }
                    return this.serial.write(u8a(addressFrame));
                })
                .then(() => this.readResponse())
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while CMD GO');
                    }
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Execute single READ command
     * @param {number} address Memory address to read from
     * @param bytesCount Number of bytes to read
     * @returns {Promise}
     */
    async cmdREAD(address, bytesCount) {
        return new Promise((resolve, reject) => {
            if (this.modbusEnabled)
            {
                resolve(u8a([0]));
            }
            else
            {
                let addressFrame;

                if (!Number.isInteger(address) || address < 0) {
                    reject(new Error('Invalid address parameter'));
                    return;
                }

                if (!Number.isInteger(bytesCount) || bytesCount <= 0 || bytesCount > this.readBlockSize) {
                    reject(new Error('Invalid bytesCount parameter'));
                    return;
                }

                if (!this.serial.isOpen()) {
                    reject(new Error('Connection must be established before sending commands'));
                    return;
                }

                addressFrame = tools.num2a(address, 4);
                console.log('AF'+u8a(addressFrame));
                addressFrame.push(this.calcChecksum(addressFrame, false));
                console.log('with Checksum'+u8a(addressFrame));
                this.serial.write(u8a([CMD_READ, 0xFF ^ CMD_READ]))
                    .then(() => this.readResponse())
                    .then(response => {
                        if (response[0] !== ACK) {
                            throw new Error('Unexpected response while ACK cmdREAD');
                        }
                        console.log(u8a(addressFrame));
                        return this.serial.write(u8a(addressFrame));
                    })
                    .then(() => this.readResponse())
                    .then(response => {
                        if (response[0] !== ACK) {
                            throw new Error('Unexpected response while ACK cmdREAD address '+response[0]);
                        }
                        // The number of bytes to be read -1 (0 <= N <= 255)
                        return this.serial.write(u8a([bytesCount - 1, (bytesCount - 1) ^ 0xFF]));
                    })
                    .then(() => this.readResponse())
                    .then(async (response) => {
                        if (response[0] !== ACK) {
                            throw new Error('Unexpected response while ACK cmdREAD response');
                        }
                        
                        while (response.length < 1+bytesCount) {
                            let res = await this.readResponse();
                            response = new Uint8Array([
                                ...response,
                                ...res
                            ]);
                        }

                        if (this.replyMode) {
                            for (let i = 0; i < bytesCount; i++) {
                                await this.readResponse(); // read and ignore
                            }
                        }
                        resolve(response.slice(1));
                    })
                    .catch(reject);
                }            
        });
    }

    /**
     * Execute Write Unprotect command
     * STM32 only
     * @returns {Promise}
     */
    async cmdWPUN() {
        return new Promise((resolve, reject) => {
            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            if (this.commands.indexOf(CMD_WPUN) === -1) {
                reject(new Error('Write Unprotect command is not supported by the current target'));
                return;
            }

            this.serial.write(u8a([CMD_WPUN, 0xFF ^ CMD_WPUN]))
                .then(() => this.readResponse())
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK CMD_WPUN');
                    }
                    return this.readResponse();
                })
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while CMD_WPUN');
                    }
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Execute Readout Unprotect command
     * STM32 only
     * @returns {Promise}
     */
    async cmdRPUN() {
        return new Promise((resolve, reject) => {
            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            if (!this.commands.length) {
                reject(new Error('Execute GET command first'));
                return;
            }

            if (this.commands.indexOf(CMD_RDU_PRM) === -1) {
                reject(new Error('Readout Unprotect command is not supported by the current target'));
                return;
            }

            this.serial.write(u8a([CMD_RDU_PRM, 0xFF ^ CMD_RDU_PRM]))
                .then(() => this.readResponse())
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK CMD_RDU_PRM');
                    }
                    return this.readResponse();
                })
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK CMD_RDU_PRM');
                    }
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Execute single WRITE command
     * @param {Uint8Array} data Data to write
     * @param {number} address Address to write at
     * @returns {Promise}
     */
    async cmdWRITE(data, address) {
        return new Promise(async (resolve, reject) => {
            if (!(data instanceof Uint8Array)) {
                reject(new Error('Missinf data to write'));
                return;
            }

            if (!Number.isInteger(address) || address < 0) {
                reject(new Error('Invalid address parameter'));
                return;
            }

            if (data.length > this.writeBlockSize) {
                reject(new Error('Data is too big, use write()'));
                return;
            }

            if (!this.commands.length) {
                reject(new Error('Execute GET command first'));
                return;
            }

            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            if (this.ewrLoadState == EwrLoadState.NOT_LOADED) {
                try {
                    await this.sendEWR();
                } catch (e) {
                    reject(e);
                    return;
                }
            }

            // Frame: number of bytes to be written (1 byte), the data (N + 1 bytes) (multiple of 4) and checksum
            let checksum = this.calcChecksum(data, true);
            let frame = new Uint8Array(data.length + 2);
            frame[0] = [data.length - 1]; //
            frame.set(data, 1);
            frame[frame.length - 1] = checksum;

            let addressFrame = tools.num2a(address, 4);
            addressFrame.push(this.calcChecksum(addressFrame, false));

            this.serial.write(u8a([CMD_WRITE, 0xFF ^ CMD_WRITE]))
                .then(() => this.readResponse())
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK cmdWRITE');
                    }
                    return this.serial.write(u8a(addressFrame));
                })
                .then(() => this.readResponse())
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK cmdWRITE read');
                    }
                    return this.serial.write(frame);
                })
                .then(() => this.readResponse())
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK cmdWRITE 2');
                    }
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Execute Get ID command
     * STM32 only
     */
    async cmdGID() {
        return new Promise((resolve, reject) => {
            if (!this.commands.length) {
                reject(new Error('Execute GET command first'));
                return;
            }

            if (this.commands.indexOf(CMD_GID) === -1) {
                reject(new Error('GET ID command is not supported by the current target'));
                return;
            }

            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            this.serial.write(u8a([CMD_GID, 0xFF ^ CMD_GID]))
                .then(() => this.readResponse())
                .then(async (response) => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK cmdGID');
                    }

                    while (response.length === 1 || response.length < response[1] + 4) {
                        let res = await this.readResponse();
                        response = new Uint8Array([
                            ...response,
                            ...res
                        ]);
                    }
                    
                    let pid = '0x' + tools.b2hexstr(response[2]) + tools.b2hexstr(response[3]);
                    resolve(pid);
                })
                .catch(reject);
        });
    }

    /**
     * Get Version & Read Protection Status command
     * STM32 only
     * @returns {Promise<InfoGV>}
     */
    async cmdGV() {
        return new Promise((resolve, reject) => {
            if (!this.commands.length) {
                reject(new Error('Execute GET command first'));
                return;
            }

            if (this.commands.indexOf(CMD_GV) === -1) {
                reject(new Error('Get Version & Read Protection Status command is not supported by the current target'));
                return;
            }

            if (!this.serial.isOpen()) {
                reject(new Error('Connection must be established before sending commands'));
                return;
            }

            this.serial.write(u8a([CMD_GV, 0xFF ^ CMD_GV]))
                .then(() => this.readResponse())
                .then(response => {
                    if (response[0] !== ACK) {
                        throw new Error('Unexpected response while ACK cmdGV');
                    }

                    let info = new InfoGV();
                    info.blVersion = (result[1] >> 4) + '.' + (result[1] & 0x0F);
                    info.countRPenabled = result[2];
                    info.countRPdisabled = result[3];
                    resolve(info);
                })
                .catch(reject);
        });
    }

    /**
     * Function to calculate the expected Modbus response size based on function code and number of registers.
     * @param {number} functionCode - The Modbus function code (e.g., 3 for Read Holding Registers)
     * @param {number} numberOfRegisters - The number of registers requested.
     * @returns {number} - The expected size of the response packet in bytes.
     */
    calculateModbusResponseSize(functionCode, numberOfRegisters) {
        let dataBytes = 0;
        
        // Handle function codes that return data
        switch (functionCode) {
            case 3: // Read Holding Registers
            case 4: // Read Input Registers
                dataBytes = numberOfRegisters * 2; // Each register is 2 bytes
                return 1 + 1 + 1 + dataBytes + 2; // Slave address + Function code + Byte count + Data bytes + CRC

            case 6: // Write Single Register
                // Response is echo of request (6 bytes)
                return 1 + 1 + 2 + 2 + 2; // Slave address + Function code + Register address + Register value + CRC

            case 16: // Write Multiple Registers
                // Response is 6 bytes: Slave address, function code, starting address, number of registers written, CRC
                return 1 + 1 + 2 + 2 + 2; // Slave address + Function code + Starting address + Number of registers written + CRC

            // Add more cases for other function codes if needed

            default:
                throw new Error("Unsupported function code");
        }
    }

    /**
     * Serial read with expected length and timeout
     * @param {number} expectedLength - The number of bytes to read
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise<Uint8Array>} - Resolves with the response bytes, or rejects on timeout/error
     */
    async readResponseWithTimeout(expectedLength, timeoutMs) {
        let result = [];
        let bytesRead = 0;

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: expected ${expectedLength} bytes, but got ${bytesRead}`)), timeoutMs)
        );

        const read = async () => {
            while (bytesRead < expectedLength) {
                const chunk = await this.serial.read();
                if (!chunk || chunk.length === 0) continue;
                result = result.concat(Array.from(chunk));
                bytesRead += chunk.length;
            }
            return new Uint8Array(result.slice(0, expectedLength));
        };

        try {
            return await Promise.race([read(), timeout]);
        } catch (e) {
            try {
                await this.serial.close(); // uses the fixed async close from WebSerial
            } catch (closeErr) {
                logger.log('Error during serial close after timeout:', closeErr);
            }
            throw e;
        }
    }

    /**
     * Serial read wrapper for single response with automatic echo mode
     * @private
     * @returns {Promise}
     */
    async readResponse() {
        return new Promise((resolve, reject) => {
            let result = null;
            this.serial.read()
                .then(response => {
                    result = response;
                    if (this.replyMode) {
                        return this.serial.write(u8a([result[0]]));
                    }
                    return Promise.resolve();
                })
                .then(() => {
                    resolve(result);
                })
                .catch(reject)
        });
    }

    /**
     * Writes erase_write_routines for STM8 A/S to RAM. All erase/write operations won't work without them
     * @private
     */
    async sendEWR() {
        return new Promise(async (resolve, reject) => {
            if (!this.ewRoutines) {
                if (!this.stm8RoutinesFile) {
                    reject(new Error('Select your device first by calling setDevice'));
                    return;
                }

                logger.log('Loading Erase-Write-Routines ' + this.stm8RoutinesFile);
                this.ewRoutines = await fetch(this.stm8RoutinesFile)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Failed fetching ' + this.stm8RoutinesFile);
                        }
                        return response.arrayBuffer();
                    })
                    .then(buffer => {
                        return new Uint8Array(buffer);
                    })
                    .catch(reject);
            }

            this.ewrLoadState = EwrLoadState.LOADING;
            logger.log('Sending Erase-Write-Routines to the device...');
            this.write(this.ewRoutines, STM8_WRITE_CODE_ADDRESS)
                .then(() => {
                    this.ewrLoadState = EwrLoadState.LOADED;
                    logger.log('Erase-Write-Routines loaded');
                    resolve();
                })
                .catch(error => {
                    this.ewrLoadState = EwrLoadState.NOT_LOADED;
                    reject(error);
                });
        });
    }

    /**
     * Activate the ROM bootloader
     * @private
     * @returns {Promise}
     */
    async activateBootloader() {
        return new Promise((resolve, reject) => {
            if (this.modbusEnabled)
            {
                logger.log('Using MODBUS.');
                resolve();
            }
            else
            {
                logger.log('Activating bootloader...');
                logger.log('Using '+settings.mcutype + ' mode');
                if (!this.serial.isOpen()) {
                    reject(new Error('Port must be opened before activating the bootloader'));
                    return;
                }
                

                let synchr_byte = (settings.mcutype=="Artery") ? SYNCHR_ARTERY : SYNCHR;
                this.enterBootMode()
                    .then(() => {
                        logger.log('Writing sync byte.');
                        this.serial.write(u8a([synchr_byte]))
                    })
                    .then(() => {
                        logger.log('Waiting for response...');
                        let res = this.serial.readWithTimeout(1000);
                        return res;
                    })
                    .then(response => {
                        if (response[0] === ACK) {
                            if (this.replyMode) {
                                logger.log('Sending ACK.');
                                return this.serial.write(u8a([ACK]));
                            }
                            return Promise.resolve();
                        } else {
                            throw new Error('Unexpected response for sync byte. Check device family');
                        }
                    })
                    .then(() => {
                        logger.log('Bootloader is ready for commands');
                        resolve();
                    })
                    .catch(error => 
                    {
                        console.log("Rejected with error");
                        console.log(error);
                        reject(error);
                    });
            }
        });
    }

    /**
     * Resets the target by toggling a control pin defined in RTS_PIN
     * @private
     * @returns {Promise}
     */
     async enterBootMode() {
        return new Promise((resolve, reject) => {
            logger.log('Enter boot mode target...');
            let signal = {};

            if (!this.serial.isOpen()) {
                reject(new Error('Port must be opened for device reset'));
                return;
            }

    // def boot(a: float, b: float) -> None:
        // ser.dtr = 0
        // ser.rts = 1
        // time.sleep(a)
        // ser.dtr = 1
        // ser.rts = 0
        // time.sleep(b)
        // ser.dtr = 0

            signal[DTR_PIN] = PIN_HIGH; //boot=1
            signal[RTS_PIN] = PIN_LOW; //reset=0
            this.serial.control(signal)
                .then(() => new Promise(resolve => setTimeout(resolve, 500)))
                .then(() => {
                    signal[DTR_PIN] = PIN_HIGH; //boot=1
                    signal[RTS_PIN] = PIN_HIGH; //reset=1
                    return this.serial.control(signal);
                })
                .then(() => new Promise(resolve => setTimeout(resolve, 500)))
                .then(() => {
                    signal[DTR_PIN] = PIN_LOW; //boot=0
                    signal[RTS_PIN] = PIN_HIGH; //reset=1
                    return this.serial.control(signal);
                })
                .then(() => {
                    resolve()
                })
                .catch(reject);
        });
    }

    /**
     * Resets the target by toggling a control pin defined in RTS_PIN
     * @private
     * @returns {Promise}
     */
    async resetTarget() {
        return new Promise((resolve, reject) => {
            logger.log('Resetting target...');
            let signal = {};

            if (!this.serial.isOpen()) {
                reject(new Error('Port must be opened for device reset'));
                return;
            }

            signal[RTS_PIN] = PIN_LOW; //RESET=0
            this.serial.control(signal)
                .then(() => {
                    logger.log('Resetting...');
                    setTimeout(resolve, 200);
                })
                .then(() => {
                    signal[RTS_PIN] = PIN_HIGH; //RESET=1
                    return this.serial.control(signal);
                })
                .then(() => {
                    // wait for device init
                    logger.log('Reset done. Wait for init.');
                    this.ewrLoadState = EwrLoadState.NOT_LOADED;
                    setTimeout(resolve, 200);
                })
                .catch(reject);
        });
    }

    /**
     * Calcualtes the checksum (XOR) of the byte array.
     * @private
     * @param data Byte Array to calculate the checksum for.
     * @param {boolean} wLength If true takes the length of the array into the account (used for data write)
     * @returns {number} Calculated checksum
     */
    calcChecksum(data, wLength) {
        let result = 0;

        for (let i = 0; i < data.length; i += 1) {
            result = result ^ data[i];
        }

        if (wLength) {
            result = result ^ (data.length - 1);
        }

        return result;
    }
}
