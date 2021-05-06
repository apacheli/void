import {
  binary_ext,
  integer_ext,
  list_ext,
  map_ext,
  new_float_ext,
  nil_ext,
  small_atom_ext,
  small_integer_ext,
} from "./terms.ts";

export class Packer {
  #encoder = new TextEncoder();
  #offset!: number;
  #uint8!: Uint8Array;
  #view!: DataView;

  #set = (b: number[] | Uint8Array) => this.#uint8.set(b, this.add(b.length));
  #u8 = (v: number) => this.#view.setUint8(this.#offset++, v);
  #u32 = (v: number) => this.#view.setUint32(this.add(4), v);
  #f64 = (v: number) => this.#view.setFloat64(this.add(8), v);

  add(addend = 2) {
    const before_offset = this.#offset;
    this.#offset += addend;
    return before_offset;
  }

  small_atom(atom: number[] | Uint8Array) {
    this.#u8(small_atom_ext);
    this.#u8(atom.length);
    this.#set(atom);
  }

  js_number(num: number) {
    if (!Number.isInteger(num)) {
      return this.new_float(num);
    } else if (num < 128 && num > -128) {
      return this.small_int(num);
    }
    this.int(num);
  }

  int(int: number) {
    this.#u8(integer_ext);
    this.#u32(int);
  }

  small_int(int: number) {
    this.#u8(small_integer_ext);
    this.#u8(int);
  }

  new_float(float: number) {
    this.#u8(new_float_ext);
    this.#f64(float);
  }

  string(str: string) {
    this.#u8(binary_ext);
    this.#u32(str.length);
    this.#set(this.#encoder.encode(str));
  }

  list(list: unknown[]) {
    if (list.length > 1) {
      this.#u8(list_ext);
      this.#u32(list.length);
      for (let i = 0; i < list.length; i++) {
        this.#pack(list[i]);
      }
    }
    this.#u8(nil_ext);
  }

  map(map: any) {
    const keys = Object.keys(map);
    this.#u8(map_ext);
    this.#u32(keys.length);
    for (const key of keys) {
      this.#pack(key);
      this.#pack(map[key]);
    }
  }

  #pack = (value: unknown) => {
    // deno-fmt-ignore-next-line
    switch (typeof value) {
      case "boolean": return this.small_atom(this.#encoder.encode(`${value}`));
      case "number": return this.js_number(value);
      case "string": return this.string(value);
      case "object": return value
        ? Array.isArray(value) ? this.list(value) : this.map(value)
        : this.small_atom([110, 105, 108]);
      case "undefined": return this.small_atom([110, 105, 108]);
    }
    throw new Error("Unsupport type");
  };

  pack(value: unknown) {
    this.#offset = 1;
    this.#uint8 = new Uint8Array(2048).fill(131, 0, 1);
    this.#view = new DataView(this.#uint8.buffer);
    this.#pack(value);
    return this.#uint8.subarray(0, this.#offset);
  }
}
