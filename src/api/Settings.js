const REPLY_MODE = 'reply_mode';
const BAUDRATE = 'baudrate';
const MCUTYPE = 'mcutype'
const DTYPE = 'dtype'
const START_ADDRESS = 'start_address';
const MODBUS = 'modbus';

class Settings {
    constructor() {
        this._replyMode = localStorage.getItem(REPLY_MODE) === "true" || false;
        this._baudrate = localStorage.getItem(BAUDRATE) || "9600";
        this._mcutype = localStorage.getItem(MCUTYPE) || "Artery";
        this._startAddress = localStorage.getItem(START_ADDRESS) || "0x8000000";
        this._modbus = localStorage.getItem(MODBUS) === "true" || false;
        this._dtype = localStorage.getItem(DTYPE) || "vmeter";
    }

    set replyMode(reply) {
        this._replyMode = reply;
        this.commit();
    }

    get replyMode() {
        return this._replyMode;
    }

    set modbus(mdbs) {
        this._modbus = mdbs;
        this.commit();
    }

    get modbus() {
        return this._modbus;
    }

    set baudrate(baudrate) {
        this._baudrate = baudrate;
        this.commit();
    }

    get baudrate() {
        return this._baudrate;
    }

    set mcutype(mcutype) {
        this._mcutype = mcutype;
        this.commit();
    }

    get mcutype() {
        return this._mcutype;
    }

    set dtype(dtype) {
        this._dtype = dtype;
        this.commit();
    }

    get dtype() {
        return this._dtype;
    }

    get startAddress() {
        return this._startAddress;
    }

    set startAddress(address) {
        this._startAddress = address;
        this.commit();
    }

    commit() {
        localStorage.setItem(REPLY_MODE, this._replyMode);
        localStorage.setItem(BAUDRATE, this._baudrate);
        localStorage.setItem(START_ADDRESS, this._startAddress);
        localStorage.setItem(MODBUS, this._modbus);
        localStorage.setItem(DTYPE, this._dtype);
    }
}

const settings = new Settings();

export default settings;