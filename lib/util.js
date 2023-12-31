/*
Copyright 2022 friends Projects 

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var crypto = require('crypto');
var base58 = require('base58-native');
var bignum = require('bignum');

exports.addressFromEx = function (exAddress, ripdm160Key) {
    try {
        var versionByte = exports.getVersionByte(exAddress);
        var addrBase = new Buffer.concat([versionByte, new Buffer(ripdm160Key, 'hex')]);
        var checksum = exports.sha256d(addrBase).slice(0, 4);
        var address = new Buffer.concat([addrBase, checksum]);
        return base58.encode(address);
    }
    catch (e) {
        return null;
    }
};
exports.getVersionByte = function (addr) {
    var versionByte = base58.decode(addr).slice(0, 1);
    return versionByte;
};
exports.sha256 = function (buffer) {
    var hash1 = crypto.createHash('sha256');
    hash1.update(buffer);
    return hash1.digest();
};
exports.sha256d = function (buffer) {
    return exports.sha256(exports.sha256(buffer));
};
exports.reverseBuffer = function (buff) {
    var reversed = new Buffer(buff.length);
    for (var i = buff.length - 1; i >= 0; i--)
        reversed[buff.length - i - 1] = buff[i];
    return reversed;
};
exports.reverseHex = function (hex) {
    return exports.reverseBuffer(new Buffer(hex, 'hex')).toString('hex');
};
exports.reverseByteOrder = function (buff) {
    for (var i = 0; i < 8; i++) buff.writeUInt32LE(buff.readUInt32BE(i * 4), i * 4);
    return exports.reverseBuffer(buff);
};
exports.uint256BufferFromHash = function (hex) {
    var fromHex = new Buffer(hex, 'hex');
    if (fromHex.length != 32) {
        var empty = new Buffer(32);
        empty.fill(0);
        fromHex.copy(empty);
        fromHex = empty;
    }
    return exports.reverseBuffer(fromHex);
};
exports.hexFromReversedBuffer = function (buffer) {
    return exports.reverseBuffer(buffer).toString('hex');
};
exports.varIntBuffer = function (n) {
    if (n < 0xfd) return new Buffer([n]);
    else if (n <= 0xffff) {
        var buff = new Buffer(3);
        buff[0] = 0xfd;
        buff.writeUInt16LE(n, 1);
        return buff;
    } else if (n <= 0xffffffff) {
        var buff = new Buffer(5);
        buff[0] = 0xfe;
        buff.writeUInt32LE(n, 1);
        return buff;
    } else {
        var buff = new Buffer(9);
        buff[0] = 0xff;
        exports.packUInt16LE(n).copy(buff, 1);
        return buff;
    }
};
exports.varStringBuffer = function (string) {
    var strBuff = new Buffer(string);
    return new Buffer.concat([exports.varIntBuffer(strBuff.length), strBuff]);
};
exports.serializeNumber = function (n) {
    if (n >= 1 && n <= 16) return new Buffer([0x50 + n]);
    var l = 1;
    var buff = new Buffer(9);
    while (n > 0x7f) {
        buff.writeUInt8(n & 0xff, l++);
        n >>= 8;
    }
    buff.writeUInt8(l, 0);
    buff.writeUInt8(n, l++);
    return buff.slice(0, l);
};
exports.serializeString = function (s) {
    if (s.length < 253)
        return new Buffer.concat([
            new Buffer([s.length]),
            new Buffer(s)
        ]);
    else if (s.length < 0x10000)
        return new Buffer.concat([
            new Buffer([253]),
            exports.packUInt16LE(s.length),
            new Buffer(s)
        ]);
    else if (s.length < 0x100000000)
        return new Buffer.concat([
            new Buffer([254]),
            exports.packUInt32LE(s.length),
            new Buffer(s)
        ]);
    else
        return new Buffer.concat([
            new Buffer([255]),
            exports.packUInt16LE(s.length),
            new Buffer(s)
        ]);
};
exports.packUInt16LE = function (num) {
    var buff = new Buffer(2);
    buff.writeUInt16LE(num, 0);
    return buff;
};
exports.packInt32LE = function (num) {
    var buff = new Buffer(4);
    buff.writeInt32LE(num, 0);
    return buff;
};
exports.packInt32BE = function (num) {
    var buff = new Buffer(4);
    buff.writeInt32BE(num, 0);
    return buff;
};
exports.packUInt32LE = function (num) {
    var buff = new Buffer(4);
    buff.writeUInt32LE(num, 0);
    return buff;
};
exports.packUInt32BE = function (num) {
    var buff = new Buffer(4);
    buff.writeUInt32BE(num, 0);
    return buff;
};
exports.packInt64LE = function (num) {
    var buff = new Buffer(8);
    buff.writeUInt32LE(num % Math.pow(2, 32), 0);
    buff.writeUInt32LE(Math.floor(num / Math.pow(2, 32)), 4);
    return buff;
};
exports.range = function (start, stop, step) {
    if (typeof stop === 'undefined') {
        stop = start;
        start = 0;
    }
    if (typeof step === 'undefined') {
        step = 1;
    }
    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }
    var result = [];
    for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }
    return result;
};
exports.pubkeyToScript = function (key) {
    if (key.length !== 66) {
        console.error('Invalid pubkey: ' + key);
        throw new Error();
    }
    var pubkey = new Buffer(35);
    pubkey[0] = 0x21;
    pubkey[34] = 0xac;
    new Buffer(key, 'hex').copy(pubkey, 1);
    return pubkey;
};
exports.miningKeyToScript = function (key) {
    var keyBuffer = new Buffer(key, 'hex');
    return new Buffer.concat([new Buffer([0x76, 0xa9, 0x14]), keyBuffer, new Buffer([0x88, 0xac])]);
};
exports.addressToScript = function (addr) {
    var decoded = base58.decode(addr);
    if (decoded.length !== 25 && decoded.length !== 26) {
        console.error('invalid address length for ' + addr);
        throw new Error();
    }
    if (!decoded) {
        console.error('base58 decode failed for ' + addr);
        throw new Error();
    }
    var pubkey = decoded.slice(1, -4);
    return new Buffer.concat([new Buffer([0x76, 0xa9, 0x14]), pubkey, new Buffer([0x88, 0xac])]);
};
exports.getReadableHashRateString = function (hashrate) {
    var i = -1;
    var byteUnits = [' KH', ' MH', ' GH', ' TH', ' PH'];
    do {
        hashrate = hashrate / 1024;
        i++;
    } while (hashrate > 1024);
    return hashrate.toFixed(2) + byteUnits[i];
};
exports.shiftMax256Right = function (shiftRight) {
    var arr256 = Array.apply(null, new Array(256)).map(Number.prototype.valueOf, 1);
    var arrLeft = Array.apply(null, new Array(shiftRight)).map(Number.prototype.valueOf, 0);
    arr256 = arrLeft.concat(arr256).slice(0, 256);
    var octets = [];
    for (var i = 0; i < 32; i++) {
        octets[i] = 0;
        var bits = arr256.slice(i * 8, i * 8 + 8);
        for (var f = 0; f < bits.length; f++) {
            var multiplier = Math.pow(2, f);
            octets[i] += bits[f] * multiplier;
        }
    }
    return new Buffer(octets);
};
exports.bufferToCompactBits = function (startingBuff) {
    var bigNum = bignum.fromBuffer(startingBuff);
    var buff = bigNum.toBuffer();
    buff = buff.readUInt8(0) > 0x7f ? Buffer.concat([new Buffer([0x00]), buff]) : buff;
    buff = new Buffer.concat([new Buffer([buff.length]), buff]);
    return compact = buff.slice(0, 4);
};
exports.bignumFromBitsBuffer = function (bitsBuff) {
    var numBytes = bitsBuff.readUInt8(0);
    var bigBits = bignum.fromBuffer(bitsBuff.slice(1));
    var target = bigBits.mul(
        bignum(2).pow(
            bignum(8).mul(
                numBytes - 3
            )
        )
    );
    return target;
};
exports.bignumFromBitsHex = function (bitsString) {
    var bitsBuff = new Buffer(bitsString, 'hex');
    return exports.bignumFromBitsBuffer(bitsBuff);
};
exports.convertBitsToBuff = function (bitsBuff) {
    var target = exports.bignumFromBitsBuffer(bitsBuff);
    var resultBuff = target.toBuffer();
    var buff256 = new Buffer(32);
    buff256.fill(0);
    resultBuff.copy(buff256, buff256.length - resultBuff.length);
    return buff256;
};
exports.getTruncatedDiff = function (shift) {
    return exports.convertBitsToBuff(exports.bufferToCompactBits(exports.shiftMax256Right(shift)));
};