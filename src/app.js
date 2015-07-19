import 'bootstrap';
import 'bootstrap/css/bootstrap.css!';

var fs = require(`fs-extra`);
var childProcess = require(`child_process`);
var codPath = process.platform === `darwin` ? `/Users/GarrettCox/Library/Application Support/Steam/steamapps/common/Call of Duty Black Ops - OSX/CoDBlackOps.app/Contents/GameData` : ``;
var modPath = `${__dirname}/mods/`;

export class Main{

	installed = require(`${__dirname}/installed.json`);
	mods = [];
	editing = null;

	activate(){
		window.ondragover = e => { e.preventDefault(); return false; }
		window.ondrop = e => { e.preventDefault(); return false; }
		updateMods().then(mods => {
			this.mods = mods;
		});
	}

	toggleEdit(mod){
		if (!mod.editing) mod.editing = true;
		else {
			mod.editing = false;
			writeJSON(`${modPath}${mod.id}/mod.json`, mod);
		}
	}

	import(e){
		this.importing = true;
		e.preventDefault();
	  var file = e.dataTransfer.files[0];
	  return copy(file.path, `${modPath}${file.name}`)
	  	.then(updateMods)
	  	.then(mods => {
	  		this.mods = mods;
	  		this.importing = false;
	  	});
	}

	install(mod){
		if (this.installed.id) {
			alert(`Please uninstall ${this.installed.id} first`);
			return;
		}

		return find(`${modPath}${mod.id}`)
			.then(files=>{
				var promiseArray = [];

				files.forEach(file=>{
					promiseArray.push(exists(`${codPath}${file}`)
						.then(doesExist => {
							if (doesExist) return makeBackup(file);
							return;
						})
						.then(() => {
							return copy(`${modPath}${mod.id}${file}`, `${codPath}${file}`);
						})
						.then(() => {
							return file;
						}));
				})
				return Promise.all(promiseArray);
			})
			.then(data => {
				this.installed.id = mod.id;
				this.installed.files = data;
				return writeJSON(`${__dirname}/installed.json`, this.installed);
			}).catch(err=>{
				console.log(err);
			})
	}

	uninstall(mod){
		var promiseArray = [];

		this.installed.files.forEach(file => {
			promiseArray.push(remove(`${codPath}${file}`)
				.then((removedPath) => {
					return exists(`${removedPath}.backup`)
				})
				.then((doesExist) => {
					if (doesExist) return rename(`${codPath}${file}.backup`, `${codPath}${file}`);
				}))
		});

		return Promise.all(promiseArray).then(() => {
			this.installed = {};
			return writeJSON(`${__dirname}/installed.json`, this.installed);
		});
	}

}

function makeBackup(file){
	return copy(`${codPath}${file}`, `${codPath}${file}.backup`);
}

function find(path){
	return new Promise((resolve, reject) => {
		var child = childProcess.spawn(`find`, [path, `-type`, `f`]);
		var output = ``;

		child.stdout.on(`data`, out => {
			output+= out;
		});
		child.stderr.on(`data`, out => {
			reject(``+out);
			return;
		});
		child.stdout.on(`close`, () => {
			var result = [];
			output = output.split(`\n`);
			output.pop();
			output.forEach(line => {
				var temp = line.substring(line.length-8, line.length);
				if (temp !== `mod.json` && temp !== 'DS_Store'){
					result.push(line.substring(path.length, line.length));
				}
			})
			resolve(result);
		});

	});
}

function updateMods(){
	return readdir(modPath)
		.then(mods => {
			var promiseArray = [];
			mods.forEach(mod => {
				if (mod[0] === '.') return;
				var modData = {};
				promiseArray.push(exists(`${modPath}${mod}/mod.json`)
					.then(doesExist => {
						if (doesExist) {
							modData = require(`${modPath}${mod}/mod.json`);
							return modData;
						} else {
							return writeJSON(`${modPath}${mod}/mod.json`, {id: mod});
						}
					}));
			});
			return Promise.all(promiseArray);
		});
}

function readdir(dirPath){
	return new Promise((resolve, reject) => {
		fs.readdir(dirPath, (err, files) => {
			if (err) reject(err);
			else resolve(files);
		});
	});
}

function exists(path){
	return new Promise((resolve, reject) => {
		fs.exists(path, exists => {
			resolve(exists);
		});
	});
}

function writeJSON(path, obj){
	return new Promise((resolve, reject) => {
		fs.writeJson(path, obj, err => {
			if (err) reject(err);
			else resolve(obj);
		});
	});
}

function copy(fromm, too){
	return new Promise((resolve, reject) => {
		fs.copy(fromm, too, {clobber: true, preserveTimestamps: true}, err => {
			if (err) reject(err);
			else resolve(fromm, too);
		});
	});
}

function remove(path){
	return new Promise((resolve, reject) => {
		fs.remove(path, err => {
			if (err) reject(err);
			else resolve(path);
		});
	});
}

function rename(oldName, newName){
	return new Promise((resolve, reject) => {
		fs.rename(oldName, newName, err => {
			if (err) reject(err);
			else resolve(newName);
		});
	});
}