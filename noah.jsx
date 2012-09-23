
import "js.jsx";

native class console {
	// static function log(value : variant) : void;
	static function info(value : variant) : void;
	static function warn(value : variant) : void;
	static function error(value : variant) : void;
	static function dir(value : variant) : void;
	static function time(label : string) : void;
	static function timeEnd(label : string) : void;
	static function trace() : void;
	//static function assert(value : variant) : void;
}

native class process {
	static __readonly__ var stdin  : Stream;
	static __readonly__ var stdout : Stream;
	static __readonly__ var stderr : Stream;

	static __readonly__ var argv : string[];
	static __readonly__ var execPath : string;
	static __readonly__ var env : Map.<string>;
	static __readonly__ var pid : int;
	static __readonly__ var arch : string;
	static __readonly__ var platform : string;
	static __readonly__ var version : string;
	static __readonly__ var versions : Map.<string>;
	static __readonly__ var title : string; // process name

	// on() cannot be type safe. any idea?

	// for "exit", and signals
	//static function on(type : string, callback : function():void) : void;
	// for "uncaughtException"
	//static function on(type : string, callback : function(:Error):void) : void;

	static function chdir(directory : string) : void;
	static function cwd() : string;
	static function exit() : void;
	static function exit(status : int) : void;

	static function getgid() : int;
	static function setgid(id : int) : void;
	static function getuid() : int;
	static function setuid(id : int) : void;

	static function kill(pid : int) : void;
	static function kill(pid : int, signal : string) : void;

	static function memoryUsage() : Map.<int>;

	static function nextTick(callback : function():void) : void;

	static function umask(mask : int) : int;
	static function uptime() : int;
}

native class Stream {
	__readonly__ var fd : int;

	__readonly__ var isTTY : boolean;
}

native class Buffer {
	__readonly__ var length : int;

	function constructor(size : int);
}

native __fake__ class FS {
	function writeSync(fd : int, buffer : Buffer, offset : int, length : int) : int;
	function writeSync(fd : int, buffer : Buffer, offset : int, length : int, position : int) : int;
	function writeSync(fd : int, str : string, position : Nullable.<int>) : int;
	function readSync(fd : int, buffer : Buffer, offset : int, length : int) : int;
	function readSync(fd : int, buffer : Buffer, offset : int, length : int, position : int) : int;
	function readFileSync(filename : string, encoding : string) : string;
}

class IO {

	var _fs = null : FS;

	function constructor() {
		var eval = js.global["eval"] as (string) -> variant;
		this._fs = eval('require("fs")') as __noconvert__ FS;
	}

	function readFile(filename : string) : string {
		var content = this._fs.readFileSync(filename, "utf8");
		return content.toString();
	}
	
}

class Pair {
	var car : variant;
	var cdr : variant;
	function constructor(car : variant, cdr : variant) {
		this.car = car;
		this.cdr = cdr;
	}
}

class Nil {
}

class Symbol {
	var name : string;
	var value : variant;
	var func : variant;
	function constructor(name : string) {
		this.name = name;
		this.value = new Nil;
		this.func = null;
	}
}

class Package {

	static var table = new  Map.<Symbol>;

	static function intern(str : string) : Symbol {
		if (str in Package.table) {
			return Package.table[str];
		}
		else {
			var symbol = new Symbol(str);
			Package.table[str] = symbol;
			return symbol;
		}
	}
	
}

class Reader {

	var str : string;
	var index : number;
	var end : number;

	function constructor(str : string) {
		this.str = str;
		this.index = 0;
		this.end = str.length;
	}

	function advance() : void {
		if (this.isEnd()) {
			throw 'EOF while reading';
		}
		++this.index;
	}

	function unwind() : void {
		if (this.index == 0) {
			throw 'Cannot unwind the stream';
		}
		--this.index;
	}

	function isEnd() : boolean {
		return this.index == this.end;
	}

	function getChar() : string {
		return this.str.charAt(this.index);
	}

	function skipWhiteSpaces() : void {
		var c;
		do {
			c = this.getChar();
			this.advance();
		} while (c == ' ' || c == '\t' || c == '\n');
		this.unwind();
	}

	function readPair() : variant {
		this.skipWhiteSpaces();

		var c = this.getChar();

		if (c == ')') {
			this.advance();
			return new Nil;
		}
		else if (c == '.') {
			this.advance();
			var result = this.read();
			this.advance(); // discard ')'
			return result;
		}
		else {
			var car = this.read();
			var cdr = this.readPair();
			return new Pair(car, cdr);
		}
	}

	function read() : variant {
		this.skipWhiteSpaces();
		
		var c = this.getChar();

		if (c == '(') {
			this.advance();
			return this.readPair();
		}
		else {
			var str = '';
			do {
				str += c;
				this.advance();
				c = this.getChar();
			} while (!(c == ' ' || c == '\t' || c == '\n' || c == ')' || c == '('));
			var num = Number.parseInt(str);
			if (Number.isNaN(num)) {
				return Package.intern(str);
			} else {
				return num;
			}
		}
	}
}

class Printer {

	static function formatPair(pair : Pair) : string {
		var str = '(';
		str += Printer.format(pair.car);
		str += ' . ';
		str += Printer.format(pair.cdr);
		str += ')';
		return str;
	}

	static function format(obj : variant) : string {
		var str = '';
		switch (typeof(obj)) {
		case 'number':
			str += (obj as number).toString();
			break;
		case 'object':
			var x = obj as Object;
			if (x instanceof Symbol) {
				str += (obj as Symbol).name;
			}
			else if (x instanceof Pair) {
				str += Printer.formatPair(obj as Pair);
			}
			else if (x instanceof Nil) {
				str += 'nil';
			}
			break;
		default:
			throw 'Unknown object';
		}
		return str;
	}
	
	static function print(obj : variant) : void {
		log Printer.format(obj);
	}
}

class Evaluator {

	static function valueIsNumber(value : variant) : boolean {
		return typeof(value) == 'number';
	}

	static function valueIsSymbol(value : variant) : boolean {
		return typeof(value) == 'object' && (value as Object) instanceof Symbol;
	}
	
	static function valueIsPair(value : variant) : boolean {
		return typeof(value) == 'object' && (value as Object) instanceof Pair;
	}

	static function valueIsNil(value : variant) : boolean {
		return typeof(value) == 'object' && (value as Object) instanceof Nil;
	}

	static function eval(expr : variant) : variant {
		if (Evaluator.valueIsNumber(expr)) {
			return expr;
		}
		else if (Evaluator.valueIsSymbol(expr)) {
			var symbol = expr as Symbol;
			if ((symbol.value as Object) instanceof Nil) {
				throw 'Unbound Symbol: '+symbol.name;
			}
			else {
				return (symbol.value as Pair).car;
			}
		}
		else if (Evaluator.valueIsPair(expr)) {
			var op = (expr as Pair).car;
			var args = (expr as Pair).cdr;
			if (Evaluator.valueIsSymbol(op)) {
				switch ((op as Symbol).name) {
				case 'defun':
					var name = (args as Pair).car;
					var lambda = new Pair(Package.intern("lambda"), (args as Pair).cdr);
					(name as Symbol).func = lambda;
					return name;
				case 'if':
					var test = Evaluator.eval((args as Pair).car);
					if (Evaluator.valueIsNil(test)) {
						return Evaluator.eval(
							new Pair(Package.intern("progn")
								,(((args as Pair).cdr) as Pair).cdr));
					}
					else {
						return Evaluator.eval((((args as Pair).cdr) as Pair).car);
					}
				case 'progn':
					var result;
					do {
						result = Evaluator.eval((args as Pair).car);
						args = (args as Pair).cdr;
					} while (!Evaluator.valueIsNil(args));
					return result;
				default:

					function eval_args(args : variant) : variant {
						if (Evaluator.valueIsNil(args)) {
							return args;
						}
						else if (Evaluator.valueIsPair(args)) {
							var pair = args as Pair;
							var car = Evaluator.eval(pair.car);
							var cdr = eval_args(pair.cdr);
							return new Pair(car, cdr);
						}
						else {
							throw 'Invalid lambda list';
							return null;
						}
					}

					var func = (op as Symbol).func;
					args = eval_args(args);
					if (typeof(func) == 'function') {
						return (func as (variant)->variant)(args);
					}
					else {
						var parms = ((func as Pair).cdr as Pair).car;

						while (!Evaluator.valueIsNil(parms)) {
							var symbol = (parms as Pair).car as Symbol;
							symbol.value = new Pair((args as Pair).car, symbol.value);
							parms = (parms as Pair).cdr;
							args = (args as Pair).cdr;
						}
						
						var body =  new Pair(Package.intern("progn"), ((func as Pair).cdr as Pair).cdr);
						var result = Evaluator.eval(body);

						parms = ((func as Pair).cdr as Pair).car;
						while (!Evaluator.valueIsNil(parms)) {
							var symbol = (parms as Pair).car as Symbol;
							symbol.value = (symbol.value as Pair).cdr;
							parms = (parms as Pair).cdr;
						}

						return result;
					}
				}
			}
			else {
				throw 'Invalid Expression';
			}
		}
		else {
			throw 'Unknown object';
		}
		return null;
	}
}

class _Main {
	static function main(args : string[]) : void {
		Package.intern("print").func = function(args : variant) : variant {
			Printer.print((args as Pair).car);
			return new Nil;
		};

		Package.intern("=").func = function(args : variant) : variant {
			var first = (args as Pair).car as number;
			var second = ((args as Pair).cdr as Pair).car as number;
			if (first == second) {
				return Package.intern("t");
			}
			else {
				return new Nil;
			}
		};

		Package.intern("*").func = function(args : variant) : variant {
			var first = (args as Pair).car as number;
			var second = ((args as Pair).cdr as Pair).car as number;
			return first * second;
		};
			
		Package.intern("-").func = function(args : variant) : variant {
			var first = (args as Pair).car as number;
			var second = ((args as Pair).cdr as Pair).car as number;
			return first - second;
		};

		var str = new IO().readFile(args[0]);
		var reader = new Reader(str);
		var obj = reader.read();
		Printer.print(Evaluator.eval(obj));
	}
}