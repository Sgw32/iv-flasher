import Serial from './Serial';

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
        this._reading = false;
    }

    init() {
        navigator.serial.onconnect = this.onConnect.bind(this);
        navigator.serial.ondisconnect = this.onDisconnect.bind(this);
    }

    isOpen() {
        return this._writer !== null;
    }

    open(parameter) {
        return this._port.open(parameter)
            .then(() => {
                this._reader = this._port.readable.getReader();
                this._writer = this._port.writable.getWriter();
                this._reading = true;
                info('<- open');
            });
    }

    async close() {
        info('-> close');
        try {
            this._reading = false;

            if (this._reader) {
                await this._reader.cancel();
                this._reader.releaseLock();
            }

            if (this._writer) {
                await this._writer.close();
                this._writer.releaseLock();
            }

            await this._port.close();

            this._reader = null;
            this._writer = null;

            info('<- close');
            if (typeof this.onDisconnect === 'function') {
                this.onDisconnect();
            }
        } catch (err) {
            this._reader = null;
            this._writer = null;
            info('<- close reject');
            throw err;
        }
    }

    read() {
        return new Promise(async (resolve, reject) => {
            if (!this._reading) return reject(new Error('Read aborted'));
            info('-> read');

            try {
                const result = await this._reader.read();
                if (result.done || !this._reading) return reject(new Error('Reader cancelled or stopped'));
                console.log('Read');
                console.log(result.value);
                resolve(result.value);
            } catch (e) {
                reject(e);
            }
        });
    }

    readWithTimeout(timeoutMilliseconds) {
        return new Promise((resolve, reject) => {
            if (!this._reading) return reject(new Error('Read aborted'));
            info('-> readWithTimeout');

            const timeoutId = setTimeout(() => {
                reject(new Error('Serial read operation timed out'));
            }, timeoutMilliseconds);

            this._reader.read()
                .then((result) => {
                    clearTimeout(timeoutId);
                    if (result.done || !this._reading) {
                        reject(new Error('Reader cancelled or stopped'));
                    } else {
                        resolve(result.value);
                    }
                })
                .catch(err => {
                    clearTimeout(timeoutId);
                    reject(err);
                });
        });
    }

    write(data) {
        return this._writer.write(data.buffer);
    }

    control(lineParams) {
        return this._port.setSignals(lineParams);
    }
}
