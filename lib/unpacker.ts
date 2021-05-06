import {
  atom_ext,
  binary_ext,
  float_ext,
  integer_ext,
  large_tuple_ext,
  list_ext,
  map_ext,
  new_float_ext,
  nil_ext,
  small_atom_ext,
  small_integer_ext,
  small_tuple_ext,
} from "./terms.ts";

export class Unpacker {
  #decoder = new TextDecoder();
  #offset = 1;
  #uint8!: Uint8Array;
  #view!: DataView;

  #i8 = () => this.#view.getInt8(this.#offset++);
  #u8 = () => this.#view.getUint8(this.#offset++);
  #u16 = () => this.#view.getUint16(this.add());
  #i32 = () => this.#view.getInt32(this.add(4));
  #u32 = () => this.#view.getUint32(this.add(4));
  #f64 = () => this.#view.getFloat64(this.add(8));

  add(addend = 2) {
    const before_offset = this.#offset;
    this.#offset += addend;
    return before_offset;
  }

  unpack_list(len: number) {
    const list = new Array(len);
    for (let i = 0; i < len; i++) {
      list[i] = this.#unpack();
    }
    return list;
  }

  unpack_list_ext(len: number) {
    const list = this.unpack_list(len);
    this.#offset++;
    return list;
  }

  unpack_map(len: number) {
    const map: any = {};
    for (let i = 0; i < len; i++) {
      map[this.#unpack()] = this.#unpack();
    }
    return map;
  }

  unpack_string(len: number) {
    const sub = this.#uint8.subarray(this.add(len), this.#offset);
    return this.#decoder.decode(sub);
  }

  #unpack = () => {
    // deno-fmt-ignore-next-line
    switch (this.#u8()) {
      case atom_ext: return unpack_atom(this.unpack_string(this.#u16()));
      case binary_ext: return this.unpack_string(this.#u32());
      case float_ext: return parseFloat(this.unpack_string(31));
      case integer_ext: return this.#i32();
      case large_tuple_ext: return this.unpack_list(this.#u32());
      case list_ext: return this.unpack_list_ext(this.#u32());
      case map_ext: return this.unpack_map(this.#u32());
      case new_float_ext: return this.#f64();
      case nil_ext: return null;
      case small_atom_ext: return this.unpack_string(this.#u8());
      case small_integer_ext: return this.#i8();
      case small_tuple_ext: return this.unpack_list(this.#u8());
    }
  };

  unpack(uint8: Uint8Array) {
    this.#offset = 1;
    this.#uint8 = uint8;
    this.#view = new DataView(uint8.buffer);
    return this.#unpack();
  }
}

const unpack_atom = (atom: string) => atom === "nil" ? null : atom;
