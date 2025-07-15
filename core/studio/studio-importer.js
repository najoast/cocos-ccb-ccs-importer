'use strict';

const Async = require('async');
const Path = require('path');
const Fs = require('fire-fs');
const DOMParser = require('xmldom').DOMParser;
const Url = require('fire-url');
const Plist = require('plist');
const CSDImporter = require('./csd-importer');
const XmlUtils = require('./xml-utils');

const AssetsRootUrl = 'db://assets';
const ResFolderName = 'cocosstudio';
const TempFolderName = 'temp';

const FntPageEXP = /page [^\n]*(\n|$)/gi;
const FntItemExp = /\w+=[^ \r\n]+/gi;
const FntIntEXP  = /^[\-]?\d+$/;

var tempResPath = '';
var projectPath = '';
var resourcePath = '';
var newResourceUrl = '';
var projectName = '';
var csdFiles = [];

function importProject (projFile, cb) {
    Editor.log('Import Cocos Studio project : ', projFile);
    projectPath = Path.dirname(projFile);
    resourcePath = Path.join(projectPath, ResFolderName);
    if (!Fs.existsSync(resourcePath) || !Fs.isDirSync(resourcePath)) {
        cb(new Error(`Resource directory ${resourcePath} is not existed.`));
        return;
    }

    var fileContent = Fs.readFileSync(projFile, 'utf-8');
    var doc = new DOMParser().parseFromString(fileContent);
    if (!doc) {
        cb(new Error(`Parse ${projFile} failed.`));
        return;
    }

    var rootElement = doc.documentElement;

    // parse the project information
    try {
        _parseProjectInfo(rootElement);
    } catch (err) {
        cb(new Error('Illegal format of project file.'));
        return;
    }

    // Validate that project name was parsed successfully
    if (!projectName || !newResourceUrl) {
        cb(new Error('Failed to parse project name from project file.'));
        return;
    }

    // import the resource files
    try {
        _createTempResPath();
        
        // create a folder with project name in assets
        _createAssetFolder(resourcePath);

        var elements = rootElement.getElementsByTagName('SolutionFolder');
        elements = elements[0].getElementsByTagName('Group');
        elements = elements[0].getElementsByTagName('RootFolder');
        var element = elements[0];
        _importResources(element, resourcePath);

        Async.waterfall([
            function(next) {
                // import raw assets
                Editor.log('Importing raw assets from: %s', tempResPath);
                Editor.assetdb.import([tempResPath], AssetsRootUrl, false, function(err, results) {
                    if (err) {
                        Editor.error('Failed to import raw assets: %s', err.message);
                        return next(err);
                    }
                    Editor.log('Raw assets import completed successfully');
                    next();
                });
            },
            function(next) {
                // import csd files
                Editor.log('Importing CSD files...');
                CSDImporter.importCSDFiles(csdFiles, resourcePath, tempResPath, newResourceUrl, next);
            }
        ], function (err) {
            if (err) {
                Editor.error('Import process failed: %s', err.message);
                _removeTempResPath();
                return cb(err);
            }
            
            Editor.log('Import Cocos Studio project finished.');
            Editor.log('Resources are imported to folder : %s', newResourceUrl);

            _removeTempResPath();
            cb();
        });
    } catch (err) {
        // TODO remove temp path if error occurred???
        //_removeTempResPath();

        Editor.error('Import resource files failed with error: %s', err.message);
        Editor.error('Stack trace: %s', err.stack);
        cb(new Error('Import resource files failed: ' + err.message));
    }
}

function _parseProjectInfo (rootNode) {
    var propElements = rootNode.getElementsByTagName('PropertyGroup');
    var propNode = propElements[0];
    projectName = propNode.getAttribute('Name');
    var projVer = propNode.getAttribute('Version');

    newResourceUrl = Url.join(AssetsRootUrl, projectName);
    // var i = 1;
    // while (Fs.existsSync(Editor.assetdb.remote._fspath(newResourceUrl))) {
    //     newResourceUrl = Url.join(AssetsRootUrl, projectName + '_' + i);
    //     i++;
    // }

    Editor.log('Project Name : %s, Cocos Studio Version : %s', projectName, projVer);
}

function _findCSDFile(folderPath) {
    // Check if the path exists and is a directory
    if (!Fs.existsSync(folderPath)) {
        return null;
    }
    
    var stats = Fs.statSync(folderPath);
    if (!stats.isDirectory()) {
        // If it's already a .csd file, return it
        if (Path.extname(folderPath) === '.csd') {
            return folderPath;
        }
        return null;
    }
    
    try {
        // Read directory contents
        var files = Fs.readdirSync(folderPath);
        
        // Look for .csd files in the directory
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (Path.extname(file) === '.csd') {
                return Path.join(folderPath, file);
            }
        }
    } catch (err) {
        Editor.warn('Failed to read directory %s: %s', folderPath, err.message);
    }
    
    return null;
}

function _rmdirRecursive (path) {
    if( !Fs.existsSync(path) ) {
        return; // Path doesn't exist, nothing to do
    }
    
    try {
        var files = Fs.readdirSync(path);
        files.forEach(function(file){
            var curPath = Path.join(path, file);
            try {
                // Check if file still exists before processing
                if (!Fs.existsSync(curPath)) {
                    return; // Skip if file doesn't exist
                }
                
                var stats = Fs.lstatSync(curPath);
                if(stats.isDirectory()) { // recurse
                    _rmdirRecursive(curPath);
                } else { // delete file
                    try {
                        Fs.unlinkSync(curPath);
                    } catch (unlinkErr) {
                        if (unlinkErr.code !== 'ENOENT') {
                            Editor.warn('Failed to delete file %s: %s', curPath, unlinkErr.message);
                        }
                    }
                }
            } catch (err) {
                // File might have been deleted already or is inaccessible
                if (err.code !== 'ENOENT') {
                    Editor.warn('Failed to process file %s: %s', curPath, err.message);
                }
            }
        });
        
        // Try to remove the directory
        try {
            Fs.rmdirSync(path);
        } catch (rmdirErr) {
            if (rmdirErr.code === 'ENOTEMPTY') {
                Editor.warn('Directory %s is not empty and cannot be removed', path);
            } else if (rmdirErr.code !== 'ENOENT') {
                Editor.warn('Failed to remove directory %s: %s', path, rmdirErr.message);
            }
        }
    } catch (readdirErr) {
        Editor.warn('Failed to read directory %s: %s', path, readdirErr.message);
    }
}

function _createTempResPath() {
    // create a temp path for import project
    if (!newResourceUrl) {
        throw new Error('newResourceUrl is not set, cannot create temp path');
    }
    
    var folderName = Url.basename(newResourceUrl);
    if (!folderName) {
        throw new Error('Invalid newResourceUrl, cannot extract folder name: ' + newResourceUrl);
    }
    
    tempResPath = Path.join(Editor.remote.Project.path, TempFolderName, folderName);
    if (Fs.existsSync(tempResPath)) {
        _rmdirRecursive(tempResPath);
    }

    Fs.mkdirsSync(tempResPath);
    Editor.log('Created temp resource path: %s', tempResPath);
}

function _removeTempResPath() {
    try {
        _rmdirRecursive(tempResPath);
    } catch (err) {
        Editor.warn('Delete temp path %s failed, please delete it manually!', tempResPath);
    }
}

function _importAsset(filePath) {
    if (! Fs.existsSync(filePath)) {
        Editor.warn('%s is not found!', filePath);
        return;
    }

    var relativePath = Path.relative(resourcePath, filePath);
    var targetPath = Path.join(tempResPath, relativePath);
    if (Fs.existsSync(targetPath)) {
        return;
    }

    Fs.copySync(filePath, targetPath);
}

function _createAssetFolder(folderPath) {
    var relativePath = Path.relative(resourcePath, folderPath);
    var newFsPath = Path.join(tempResPath, relativePath);
    if (!Fs.existsSync(newFsPath)) {
        Fs.mkdirsSync(newFsPath);
    }
}

function _importParticle(particleFile) {
    if (!particleFile) {
        Editor.warn('_importParticle called with undefined particleFile');
        return;
    }
    
    _importAsset(particleFile);

    if (!Fs.existsSync(particleFile)) {
        return;
    }

    try {
        var dict = Plist.parse(Fs.readFileSync(particleFile, 'utf8'));
        if (dict && dict['textureFileName']) {
            var textureFileName = dict['textureFileName'];
            if (typeof textureFileName === 'string' && textureFileName.trim()) {
                var imgPath = Path.join(Path.dirname(particleFile), textureFileName);
                if (Fs.existsSync(imgPath)) {
                    _importAsset(imgPath);
                } else {
                    Editor.warn('Texture file not found for particle: %s', imgPath);
                }
            } else {
                Editor.warn('Invalid textureFileName in particle file: %s', particleFile);
            }
        } else {
            Editor.warn('No textureFileName found in particle file: %s', particleFile);
        }
    } catch (err) {
        Editor.error('Failed to parse particle file %s: %s', particleFile, err.message);
    }
}

function _importTMX(tmxFile) {
    _importAsset(tmxFile);

    if (!Fs.existsSync(tmxFile)) {
        return;
    }

    var fileContent = Fs.readFileSync(tmxFile, 'utf-8');
    var doc = new DOMParser().parseFromString(fileContent);
    if (!doc) {
        Editor.warn('Parse %s failed.', tmxFile);
        return;
    }

    function _importTilesetImages(tilesetNode, sourcePath) {
        var images = tilesetNode.getElementsByTagName('image');
        for (var i = 0, n = images.length; i < n ; i++) {
            var imageCfg = images[i].getAttribute('source');
            if (imageCfg) {
                var imgPath = Path.join(Path.dirname(sourcePath), imageCfg);
                _importAsset(imgPath);
            }
        }
    }

    var rootElement = doc.documentElement;
    var tilesetElements = rootElement.getElementsByTagName('tileset');
    for (var i = 0, n = tilesetElements.length; i < n; i++) {
        var tileset = tilesetElements[i];
        var sourceTSX = tileset.getAttribute('source');
        if (sourceTSX) {
            var tsxPath = Path.join(Path.dirname(tmxFile), sourceTSX);
            _importAsset(tsxPath);

            if (Fs.existsSync(tsxPath)) {
                var tsxContent = Fs.readFileSync(tsxPath, 'utf-8');
                var tsxDoc = new DOMParser().parseFromString(tsxContent);
                if (tsxDoc) {
                    _importTilesetImages(tsxDoc, tsxPath);
                } else {
                    Editor.warn('Parse %s failed.', tsxPath);
                }
            }
        }

        // import images
        _importTilesetImages(tileset, tmxFile);
    }
}

function _importFNT(fntFile) {
    _importAsset(fntFile);

    if (!Fs.existsSync(fntFile)) {
        return;
    }

    var fntContent = Fs.readFileSync(fntFile, 'utf8');
    var matchCfgs = fntContent.match(FntPageEXP);
    if (!matchCfgs || matchCfgs.length === 0) {
        Editor.warn('Parse fnt file %s failed!', fntFile);
        return;
    }

    var pageCfg = matchCfgs[0];
    var arr = pageCfg.match(FntItemExp);
    if (arr) {
        var pageObj = {};
        for (var i = 0, li = arr.length; i < li; i++) {
            var tempStr = arr[i];
            var index = tempStr.indexOf('=');
            var key = tempStr.substring(0, index);
            var value = tempStr.substring(index + 1);
            if (value.match(FntIntEXP)) value = parseInt(value);
            else if (value[0] === '"') value = value.substring(1, value.length - 1);
            pageObj[key] = value;
        }

        if (pageObj.file) {
            var imgPath = Path.join(Path.dirname(fntFile), pageObj.file);
            _importAsset(imgPath);
        } else {
            Editor.warn('Get image file config from fnt file %s failed!', fntFile);
        }
    } else {
        Editor.warn('Get "page" config from fnt file %s failed!', fntFile);
    }
}

function _importResources(node, resPath) {
    if (!node || !resPath) {
        Editor.warn('_importResources called with invalid parameters: node=%s, resPath=%s', node, resPath);
        return;
    }
    
    for (var i = 0, n = node.childNodes.length; i < n; i++) {
        var child = node.childNodes[i];
        if (XmlUtils.shouldIgnoreNode(child)) {
            continue;
        }

        var nameAttr = child.getAttribute('Name');
        if (!nameAttr || typeof nameAttr !== 'string') {
            Editor.warn('Skipping node with invalid Name attribute: %s', nameAttr);
            continue;
        }
        
        var filePath = Path.join(resPath, nameAttr);
        switch (child.nodeName) {
            case 'Folder':
                _createAssetFolder(filePath);
                _importResources(child, filePath);
                break;
            case 'Project':
                // csd file, find the actual .csd file in the project folder
                var csdFilePath = _findCSDFile(filePath);
                if (csdFilePath) {
                    csdFiles.push(csdFilePath);
                }
                break;
            case 'PlistInfo':
                // csi file, do nothing
                break;
            case 'Image':
            case 'TTF':
            case 'Audio':
                _importAsset(filePath);
                break;
            case 'PlistImageFolder':
                var plistFile = Path.join(resPath, child.getAttribute('PListFile'));
                _importAsset(plistFile);
                var imgFile = Path.join(resPath, child.getAttribute('Image'));
                _importAsset(imgFile);
                break;
            case 'Fnt':
                _importFNT(filePath);
                break;
            case 'PlistParticleFile':
                _importParticle(filePath);
                break;
            case 'TmxFile':
                _importTMX(filePath);
                break;
            default:
                break;
        }
    }
}

module.exports = {
    name: 'Cocos Studio',
    exts: 'ccs',
    importer: importProject,
};
