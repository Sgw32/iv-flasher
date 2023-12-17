import minimalmodbus
import serial
import time

def modbus_poll(slave_address, register_address, number_of_registers, baudrate=9600, serial_port='/dev/ttyUSB0'):
    # Create the serial port connection
    instrument = minimalmodbus.Instrument(serial_port, slave_address, debug = True)
    instrument.serial.timeout = 0.2
    instrument.serial.baudrate = baudrate
    time.sleep(1)
    data = instrument.read_registers(register_address, number_of_registers)
    instrument.write_register(11,1000,functioncode=6)
    instrument.write_register(12,10442,functioncode=6)
    instrument.write_register(0xABCD,0xABCD,functioncode=6)
    while True:
        try:
            # Read data from Modbus device
            data = instrument.read_registers(register_address, number_of_registers)
            if data is not None:
                print(f"Data read from Modbus device: {data}")
            else:
                print("Failed to read data from Modbus device.")
            # Add a delay before the next poll
            time.sleep(1)
        except Exception as e:
            print(f"Error: {e}")
            return None
        

if __name__ == "__main__":
    # Set your Modbus device parameters
    slave_address = 1
    register_address = 0  # Change this to the starting register address you want to read
    number_of_registers = 13  # Change this to the number of registers you want to read

    # Set your serial port parameters
    serial_port = 'COM3'  # Change this to your serial port
    baudrate = 115200  # Change this to your baudrate
    
    # Poll the Modbus device
    modbus_poll(slave_address, register_address, number_of_registers, baudrate, serial_port)

        
