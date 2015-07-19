angular.module('blackopsmodmanager', [])
	.controller('controller', Controller);

var Promise = require('bluebird');
var childProcess = require('child_process');
var fs = require('fs-extra');
var installed = require(__dirname + '/installed.json');
var codPath = process.platform === 'darwin' ? '/Users/GarrettCox/Library/Application Support/Steam/steamapps/common/Call of Duty Black Ops - OSX/CoDBlackOps.app/Contents/GameData' : '';
var modPath = __dirname + '/mods/';

function Controller($scope) {
	var self = this;

	self.installed = installed;
	self.mods = [];

	self.toggleEdit = function(mod){
		if (!mod.editing) mod.editing = true;
		else {
			mod.editing = false;
			return writeJSON(modPath + mod.id + '/mod.json', mod);
		}
	}

	self.import = function(e){
		e.preventDefault();
	  var file = e.dataTransfer.files[0];
	  return copy(file.path, modPath + file.name)
	  	.then(updateMods)
	  	.then(function(mods){
	  		self.mods = mods;
	  		$scope.$digest();
	  	});
	}

	self.install = function(mod){
		if (self.installed.id) {
			alert('Please uninstall '+self.installed.id+' first');
			return;
		}

		return find(modPath + mod.id)
			.then(function(files){
				var promiseArray = [];

				files.forEach(function(file){
					promiseArray.push(exists(codPath + file)
						.then(function(doesExist){
							if (doesExist) return makeBackup(file);
							return;
						})
						.then(function(){
							return copy(modPath + mod.id + file, codPath + file);
						})
						.then(function(){
							return file;
						}));
				})
				return Promise.all(promiseArray);
			})
			.then(function(data){
				self.installed.id = mod.id;
				self.installed.files = data;
				return writeJSON(__dirname+'/installed.json', self.installed)
			})
			.then(function() {
				$scope.$digest();
			});
	}

	self.uninstall = function(mod){
		var promiseArray = [];

		self.installed.files.forEach(function(file){
			promiseArray.push(remove(codPath + file)
				.then(function(removedPath){
					return exists(removedPath + '.backup')
				})
				.then(function(doesExist){
					if (doesExist) return rename(codPath + file + '.backup', codPath + file);
				}))
		});

		return Promise.all(promiseArray).then(function(){
			self.installed = {};
			return writeJSON(__dirname + '/installed.json', self.installed);
		})
		.then(function() {
			$scope.$digest();
		});
	}

	window.ondragover = function(e){ e.preventDefault(); return false; }
	window.ondrop = self.import;
	updateMods()
		.then(function(mods){
			self.mods = mods;
			$scope.$digest();
		});

}

function makeBackup(file){
	return copy(codPath + file, codPath + file + '.backup');
}

function find(path){
	return new Promise(function(resolve, reject){
		var child = childProcess.spawn('find', [path, '-type', 'f']);
		var output = '';

		child.stdout.on('data', function(out){
			output+= out;
		});
		child.stderr.on('data', function(out){
			reject(''+out);
			return;
		});
		child.stdout.on('close', function(){
			var result = [];
			output = output.split('\n');
			output.pop();
			output.forEach(function(line){
				var temp = line.substring(line.length-8, line.length);
				if (temp !== 'mod.json' && temp !== 'DS_Store'){
					result.push(line.substring(path.length, line.length));
				}
			})
			resolve(result);
		});

	});
}

function updateMods(){
	return readdir(modPath)
	.then(function(mods){
		var promiseArray = [];
		mods.forEach(function(mod){
			if (mod[0] === '.') return;
			var modData = {};
			promiseArray.push(exists(modPath + mod + '/mod.json')
				.then(function(doesExist){
					if (doesExist) {
						modData = require(modPath + mod + '/mod.json');
						return modData;
					} else {
						return writeJSON(modPath + mod + '/mod.json', {id: mod});
					}
				}));
		});
		return Promise.all(promiseArray);
	});
}

function readdir(dirPath){
	return new Promise(function(resolve, reject){
		fs.readdir(dirPath, function(err, files){
			if (err) reject(err);
			else resolve(files);
		});
	});
}

function exists(path){
	return new Promise(function(resolve, reject){
		fs.exists(path, function(doesExist){
			resolve(doesExist);
		});
	});
}

function writeJSON(path, obj){
	return new Promise(function(resolve, reject){
		fs.writeJson(path, obj, function(err){
			if (err) reject(err);
			else resolve(obj);
		});
	});
}

function copy(fromm, too){
	return new Promise(function(resolve, reject){
		fs.copy(fromm, too, {clobber: true, preserveTimestamps: true}, function(err){
			if (err) reject(err);
			else resolve(fromm, too);
		});
	});
}

function remove(path){
	return new Promise(function(resolve, reject){
		fs.remove(path, function(err){
			if (err) reject(err);
			else resolve(path);
		});
	});
}

function rename(oldName, newName){
	return new Promise(function(resolve, reject){
		fs.rename(oldName, newName, function(err){
			if (err) reject(err);
			else resolve(newName);
		});
	});
}