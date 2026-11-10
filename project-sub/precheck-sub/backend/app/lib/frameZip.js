'use strict';

const fs = require('fs');
const zlib = require('zlib');

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function writeStoredZip(zipPath, files) {
  const handle = await fs.promises.open(zipPath, 'w');
  const centrals = [];
  let offset = 0;
  try {
    for (const file of files) {
      const name = Buffer.from(file.name, 'utf8');
      const raw = await fs.promises.readFile(file.filePath);
      const data = zlib.deflateRawSync(raw);
      const crc = crc32(raw);
      const local = Buffer.concat([
        u32(0x04034b50),
        u16(20),
        u16(0),
        u16(8),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(raw.length),
        u16(name.length),
        u16(0),
        name,
        data,
      ]);
      await handle.write(local);
      centrals.push(Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(8),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(raw.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]));
      offset += local.length;
    }
    const centralDir = Buffer.concat(centrals);
    const end = Buffer.concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(files.length),
      u16(files.length),
      u32(centralDir.length),
      u32(offset),
      u16(0),
    ]);
    await handle.write(Buffer.concat([ centralDir, end ]));
  } finally {
    await handle.close();
  }
}

module.exports = { writeStoredZip };
