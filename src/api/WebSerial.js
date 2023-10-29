import Serial from './Serial'

function info(msg) {
    console.info('[WebSerial] ' + msg);
}

export default class WebSerial extends Serial {
    constructor(port) {
        super();
        if (!(port instanceof SerialPort)) {
            throw new Error('Expected a SerialPort object');
        }
        this._port = port;
        this._reader = null;
        this._writer = null;
    }

    init() {
        navigator.serial.onconnect = this.onConnect.bind(this);
        navigator.serial.ondisconnect = this.onDisconnect.bind(this);
    }

    /**
     * Check if a connection is opened.
     */
    isOpen() {
        return this._writer !== null;
    }

    /**
     * Open the serial port
     * @param {Object} parameter Parameter
     */
    open(parameter) {
        return new Promise((resolve, reject) => {
            info('-> open ' + JSON.stringify(parameter));
            this._port.open(parameter)
                .then(() => {
                    this._reader = this._port.readable.getReader();
                    this._writer = this._port.writable.getWriter();
                    info('<- open');
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Close the current connection
     */
    close() {
        return new Promise((resolve, reject) => {
            info('-> close');
            this._reader.cancel();
            this._writer.close();
            Promise.all([this._reader.closed, this._writer.closed])
                .then(() => this._port.close())
                .then(() => {
                    this._reader = null;
                    this._writer = null;
                    info('<- close');
                    this.onDisconnect();
                    resolve();
                })
                .catch((err) => {
                    this._reader = null;
                    this._writer = null;
                    info('<- close reject');
                    reject(err);
                });
        });
    }

    /**
     * Read data from the serial port
     */
    read() {
        return new Promise(async (resolve, reject) => {
            info('-> read');

            this._reader.read()
                .then((result) => {
                    console.debug(result);
                    resolve(result.value);
                })
                .catch(reject);
        });
    }

    /**
     * Writes data to serial port
     * @param {Uint8Array} data Data to send.
     */
    write(data) {
        return new Promise((resolve, reject) => {
            info('-> write');
            console.debug(data);
            this._writer.write(data.buffer)
                .then(resolve)
                .catch(reject);
        });
    }

    /**
     * Set the control signals of the current connection
     * @param {dtr:boolean, rts:boolean} lineParams signal parameters
     */
    control(lineParams) {
        return new Promise((resolve, reject) => {
            info('-> control');
            console.debug(lineParams)
            this._port.setSignals(lineParams)
                .then(() => {
                    resolve();
                })
                .catch(reject);
        });
    }
}
