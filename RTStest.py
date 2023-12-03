import time
import serial

# Since we are doing the RTS and CTS logic ourselves, keep 'rtscts=False'
mySerial = serial.Serial(port='COM4', baudrate=9600, rtscts=False)
#mySerial = serial.Serial(port='CO', baudrate=9600, rtscts=False)

# To send some information:

dataToSend = 'HelloWorld!'
print('rts 1')
mySerial.rts = False
mySerial.dtr = False
for i in range(100):
    mySerial.rts = False
    mySerial.rts = True

for i in range(0,100):
    mySerial.write(bytes(dataToSend, 'ascii'))
time.sleep(5) # Wait for the data to have sent before disabling RTS
print('rts 0')
mySerial.rts = False
time.sleep(5)
print('dtr 1')
mySerial.dtr = True
time.sleep(5)
print('dtr 0')
mySerial.dtr = False
time.sleep(5)
mySerial.close()

