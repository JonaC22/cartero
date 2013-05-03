/*
 * grunt-asset-bundler
 * https://github.com/go-oleg/bundler
 *
 * Copyright (c) 2013 Oleg Seletsky
 * Licensed under the MIT license.
 */

var assetBundlerUtil = require( "./../lib/util.js" ),
	_ = require( "underscore" ),
	_s = require( "underscore.string" ),
	fs = require( "fs" ),
	findit = require( "findit" );

'use strict';

module.exports = function(grunt) {

	var assetBundlerTaskPrefix = "ASSET_BUNDLER";

	var kAssetFileExtensions = [ "**/*.js", "**/*.css", "**/*.tmpl" ];

	var kBundleMapJSONFile = "bundleMap.json";
	var kPageMapJSONFile = "pageMap.json";
	var kAssetBundlerDir = "assetBundler/";

	var kAppPagesDefaults = {
		srcDir : "WebServer/AppPages/",
		destDir : "WebServer/Static/AppPages-assets/",
		filesToIgnore : /_.*/,
		foldersToIgnore : /__.*/
	};

	var kAssetLibraryDefaults = {
		srcDir : "AssetLibrary/",
		destDir : "WebServer/Static/AssetLibrary-assets/"
	}

	var compileAssetsMap = {
		coffee : {
			src : ".coffee",
			dest : ".js"
		},
		compass : {
			src : ".scss",
			dest : ".css"
		},
		less : {
			src : ".less",
			dest : ".css"
		},
		//jade?
		stylus : {
			src : ".styl",
			dest : ".css"
		}
	};

	var options = {};

	var mode;

	var pageMap = {};
	var bundleMap = {};

	function resolveAssetFilePath( fileName ) {
		return fileName.replace( "{ASSET_LIBRARY}/", options.assetLibrary.destDir ).replace( "{APP_PAGES}/", options.appPages.destDir );
	}

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

	grunt.registerMultiTask('assetbundler', 'Your task description goes here.', function() {

		options = this.options();

		options.assetLibrary = options.assetLibrary || {};
		options.assetLibrary = _.extend(
			{},
			kAssetLibraryDefaults,
			options.assetLibrary );

		options.appPages = options.appPages || {};
		options.appPages = _.extend(
			{},
			kAppPagesDefaults,
			options.appPages );

		options = _.extend(
			{},
			{
				useDirectoriesForDependencies : true,
				serverSideTemplateSuffix : ".swig"
			},
			options
		);

		mode = options.mode;
		//console.log( "mode: " + mode );
		//grunt.log.writeln( JSON.stringify( options, null, "\t") );

		var copy = grunt.config( "copy" ) || {};
		var clean = grunt.config( "clean" ) || {};
		var watch = grunt.config( "watch" ) || {};
		var concat = grunt.config( "concat" ) || {};

		copy[ assetBundlerTaskPrefix ] = {
			files : [
				{
					src: kAssetFileExtensions,
					dest : options.assetLibrary.destDir,
					expand : true,
					cwd : options.assetLibrary.srcDir
				},
				{
					src: kAssetFileExtensions,
					dest : options.appPages.destDir,
					expand : true,
					cwd : options.appPages.srcDir
				}
			]
		};

		grunt.config( "copy", copy );

		clean[ assetBundlerTaskPrefix ] = [ options.assetLibrary.destDir , options.appPages.destDir, kAssetBundlerDir ];

		clean[ assetBundlerTaskPrefix + "_js" ] = {
			src : "<%= filesToCleanJS %>"
		};

		clean[ assetBundlerTaskPrefix + "_css" ] = {
			src : "<%= filesToCleanCSS %>"
		};

		clean[ assetBundlerTaskPrefix + "_tmpl" ] = {
			src : "<%= filesToCleanTMPL %>"
		};

		grunt.config( "clean", clean );

		_.each( _.keys( compileAssetsMap ), function( taskName ) {

			var task = grunt.config( task ) || {};

			var taskOptions = compileAssetsMap[ taskName ];

			var userSpecifiedOptions;

			if( ! _.isUndefined( options.preprocessingOptions ) ) {
				userSpecifiedOptions = options.preprocessingOptions[ taskName ];
			}

			if( taskName === "compass" ) {

				if( _.isUndefined( userSpecifiedOptions ) ) userSpecifiedOptions = {};
				
				var assetLibraryOptions = _.extend( {}, {
					sassDir : options.assetLibrary.srcDir,
					cssDir : options.assetLibrary.destDir
				},
				userSpecifiedOptions );

				task[ assetBundlerTaskPrefix + "_assetLibrary" ] = {
					options : assetLibraryOptions
				};

				var appPagesOptions = _.extend( {}, {
					sassDir : options.appPages.srcDir,
					cssDir : options.appPages.destDir
				},
				userSpecifiedOptions );

				task[ assetBundlerTaskPrefix + "_appPages" ] = {
					options : appPagesOptions
				};

			}
			else {
				task[ assetBundlerTaskPrefix + "_assetLibrary" ] = {
						expand: true,
					cwd: options.assetLibrary.srcDir,
					src: [ "**/*" + taskOptions.src ],
					dest: options.assetLibrary.destDir,
					ext: taskOptions.dest
				};

				task[ assetBundlerTaskPrefix + "_appPages" ] = {
					expand: true,
					cwd: options.appPages.srcDir,
					src: [ "**/*" + taskOptions.src ],
					dest: options.appPages.destDir,
					ext: taskOptions.dest
				};

				if( ! _.isUndefined( userSpecifiedOptions ) ) {
					task[ assetBundlerTaskPrefix + "_assetLibrary" ].options = userSpecifiedOptions;
					task[ assetBundlerTaskPrefix + "_appPages" ].options = userSpecifiedOptions;
				}

			}

			grunt.config( taskName, task );

		} );

		_.each( options.minificationTasks, function( taskConfig ) {

			var task = grunt.config( taskConfig.name ) || {};

			//TODO: add support for multiple suffixes
			task[ assetBundlerTaskPrefix + "_assetLibrary" ] = {
				options : taskConfig.options,
				expand: true,
				cwd: options.assetLibrary.destDir,
				src: [ "**/*" + taskConfig.suffixes[0] ],
				rename: function(dest, src){ return dest + src; },
				dest: options.assetLibrary.destDir
				//ext: taskConfig.suffixes[0]
			};

			task[ assetBundlerTaskPrefix + "_appPages" ] = {
				options : taskConfig.options,
				expand: true,
				cwd: options.appPages.destDir,
				src: [ "**/*" + taskConfig.suffixes[0] ],
				rename: function(dest, src){ return dest + src; },
				dest: options.appPages.destDir
				//ext: taskConfig.suffixes[0]
			};

			grunt.config( taskConfig.name, task );

		} );

		concat[ assetBundlerTaskPrefix + "_js" ] = {
			src : "<%= filesToConcatJS %>",
			dest : "<%= concatedFileDestJS %>"
		};

		concat[ assetBundlerTaskPrefix + "_css" ] = {
			src : "<%= filesToConcatCSS %>",
			dest : "<%= concatedFileDestCSS %>"
		};

		concat[ assetBundlerTaskPrefix + "_tmpl" ] = {
			src : "<%= filesToConcatTMPL %>",
			dest : "<%= concatedFileDestTMPL %>"
		};

		grunt.config( "concat", concat );

		_.each( _.keys( compileAssetsMap ), function( taskName ) {

			var taskOptions = compileAssetsMap[ taskName ];

			watch[ assetBundlerTaskPrefix + "_assetLibrary_" + taskName ] = {
				files : [ options.assetLibrary.srcDir + "**/*" + taskOptions.src ],
				tasks : [ "processFileChange" ],
				options : {
					nospawn : true
				}
			};

			watch[ assetBundlerTaskPrefix + "_appPages_" + taskName ] = {
				files : [ options.appPages.srcDir + "**/*" + taskOptions.src ],
				tasks : [ "processFileChange" ],
				options : {
					nospawn : true
				}
			};

		} );

		watch[ assetBundlerTaskPrefix + "_server-side-template" ] = {
			files : [ options.appPages.srcDir + "**/*" + options.serverSideTemplateSuffix ],
			tasks : [ "processServerSideTemplateChange" ],
			options : {
				nospawn : true
			}
		};

		var assetFilesToWatch = _.map( kAssetFileExtensions, function( extension ) {
			return options.assetLibrary.srcDir + extension;
		} );

		assetFilesToWatch = _.union( assetFilesToWatch, _.map( kAssetFileExtensions, function( extension ) {
			return options.appPages.srcDir + extension;
		} ) );

		watch[ assetBundlerTaskPrefix + "_copy" ] = {

			files : assetFilesToWatch,
			tasks : [ "processFileChange" ],
			options : {
				nospawn : true
			}

		};

		grunt.config( "watch", watch );

		grunt.task.run( "clean:ASSET_BUNDLER" );
		grunt.task.run( "prepare" );
		grunt.task.run( "copy" );

		_.each( _.keys( compileAssetsMap ), function( taskName ) {
			grunt.task.run( taskName + ":" + assetBundlerTaskPrefix + "_assetLibrary" );
			grunt.task.run( taskName + ":" + assetBundlerTaskPrefix + "_appPages" );
		} );

		grunt.task.run( "buildBundleAndPageJSONs:" + mode );

		if( mode === "prod" ) {
			grunt.task.run( "buildKeepSeparateBundles" );
			grunt.task.run( "buildPageBundles" );

			//TODO: only run the asset bundler targets
			_.each( options.minificationTasks, function( taskConfig ) {
				grunt.task.run( taskConfig.name );
			} );
		}

		grunt.task.run( "replaceBundlerDirTokens" );

		grunt.task.run( "resolveAndInjectDependencies" );
		grunt.task.run( "saveBundleAndPageJSONs" );

		//grunt.log.writeln("options: " + JSON.stringify( grunt.config( "watch" ), null, "\t" ) );

		//grunt.log.writeln("processFileChange: " + JSON.stringify( grunt.config( "processFileChange" ), null, "\t" ) );

		if( mode === "dev" ) {
			grunt.task.run( "watch" );
		}

	} );

	grunt.registerTask( "processFileChange", "", function() {

		grunt.task.run( "copy" );

		_.each( _.keys( compileAssetsMap ), function( taskName ) {
			grunt.task.run( taskName + ":" + assetBundlerTaskPrefix + "_assetLibrary" );
			grunt.task.run( taskName + ":" + assetBundlerTaskPrefix + "_appPages" );
		} );

		grunt.task.run( "resolveAndInjectDependencies" );
		grunt.task.run( "saveBundleAndPageJSONs" );

	} );

	grunt.registerTask( "processServerSideTemplateChange", "", function() {

		// if a server-side template changed, assume the worst case senario
		// ( that the bundler_require contents changed )
		// rebuild the bundleMap and pageMap, re-resolve the dependencies, and save
		// could be more granular
		grunt.task.run( "buildBundleAndPageJSONs:" + mode );
		grunt.task.run( "resolveAndInjectDependencies" );
		grunt.task.run( "saveBundleAndPageJSONs" );

	} );

	grunt.registerTask( "prepare", "Prepare directories for build", function() {

		//grunt.log.writeln( JSON.stringify( options, null, "\t") );
		grunt.file.mkdir( options.assetLibrary.destDir );
		grunt.file.mkdir( options.appPages.destDir );

		var configOptions = {
			assetLibrarySrc : options.assetLibrary.srcDir,
			assetLibraryDest : options.assetLibrary.destDir,
			appPagesSrc : options.appPages.srcDir,
			appPagesDest : options.appPages.destDir,
			//bundlerRequireDirective : grunt.config.get( "bundlerRequireDirective" ),
			//bundlerExtendsDirective : grunt.config.get( "bundlerExtendsDirective" ),
			projectRootDir : __dirname,
			bundleMap : kAssetBundlerDir + kBundleMapJSONFile,
			pageMap : kAssetBundlerDir + kPageMapJSONFile
		};

		grunt.config.set( "configOptions", configOptions );

		assetBundlerUtil.saveBundlerConfig( configOptions );

		//grunt.file.write( kAssetBundlerDir + "config.json", JSON.stringify( configOptions, null, "\t" ) );

	} );

	grunt.registerTask( "buildBundleAndPageJSONs", "Build bundle and page map JSONs", function( mode ) {

		//var bundleMap = assetBundlerUtil.buildBundlesMap( grunt.config.get( "tmpDir" ) + grunt.config.get( "assetLibrarySrc" ) );

		bundleMap = assetBundlerUtil.buildBundlesMap( options.assetLibrary.srcDir, options);

		try {
			assetBundlerUtil.resolveBundlesMap( bundleMap, mode );
		}
		catch( e ) {
			grunt.fail.fatal(e, 1 );
		}

		//grunt.config.set( "bundleMap", bundleMap );
		//grunt.file.write( kDependencyJSONFile, JSON.stringify( bundleMap , null, "\t" ) );

		//var templateMap = assetBundlerUtil.buildTemplatesMap( grunt.config.get( "tmpDir" ) + grunt.config.get( "appPagesSrc" ) );
		pageMap = assetBundlerUtil.buildPagesMap( options.appPages.srcDir, options.appPages );
		assetBundlerUtil.resolvePagesMap( pageMap, bundleMap, mode );

		//grunt.config.set( "pageMap", pageMap );
		//grunt.file.write( kTemplateMapJSONFile, JSON.stringify( templateMap , null, "\t" ) );

	} );

	grunt.registerTask( "buildKeepSeparateBundles", "Builds the keep separate bundle files.", function() {

		this.requires( "buildBundleAndPageJSONs:prod" );
		//var bundleMap = grunt.config.get( "bundleMap" );
		var keepSeparateBundles = _.filter( _.values( bundleMap ), function( bundle ) {
			return bundle.keepSeparate;
		} );
		grunt.config.set( "keepSeparateBundles", keepSeparateBundles );
		grunt.task.run( "buildKeepSeparateBundlesHelper" );

	} );

	grunt.registerTask( "buildKeepSeparateBundlesHelper", "", function() {

		var keepSeparateBundles = grunt.config.get( "keepSeparateBundles" );
		if( keepSeparateBundles.length === 0 ) return;
		var bundle = keepSeparateBundles.pop();
		grunt.config.set( "keepSeparateBundles", keepSeparateBundles );

		var files = bundle.files;
		var filesToConcatCSS = [];
		var filesToConcatJS = [];
		var filesToConcatTMPL = [];

		_.each( files, function( file ) {
			if( _s.endsWith( file, ".css" ) )
				filesToConcatCSS.push( resolveAssetFilePath( file ) );
			else if ( _s.endsWith( file, ".js" ) )
				filesToConcatJS.push( resolveAssetFilePath( file ) );
			else if( _s.endsWith( file, ".tmpl" ) )
				filesToConcatTMPL.push( resolveAssetFilePath( file ) );
		} );

		grunt.config.set( "filesToConcatJS", filesToConcatJS );
		grunt.config.set( "filesToConcatCSS", filesToConcatCSS );
		grunt.config.set( "filesToConcatTMPL", filesToConcatTMPL );
		grunt.config.set( "concatedFileDestJS", options.assetLibrary.destDir + bundle.name.replace(/\//g,"_") + "_combined.js" );
		grunt.config.set( "concatedFileDestCSS", options.assetLibrary.destDir + bundle.name.replace(/\//g,"_") + "_combined.css" );
		grunt.config.set( "concatedFileDestTMPL", options.assetLibrary.destDir + bundle.name.replace(/\//g,"_") + "_combined.tmpl" );

		grunt.config.set( "filesToCleanJS", filesToConcatJS );
		grunt.config.set( "filesToCleanCSS", filesToConcatCSS );
		grunt.config.set( "filesToCleanTMPL", filesToConcatTMPL );

		grunt.task.run( "concat:" + assetBundlerTaskPrefix + "_js" );
		grunt.task.run( "concat:" + assetBundlerTaskPrefix + "_css" );
		grunt.task.run( "concat:" + assetBundlerTaskPrefix + "_tmpl" );

		grunt.task.run( "clean:" + assetBundlerTaskPrefix + "_js" );
		grunt.task.run( "clean:" + assetBundlerTaskPrefix + "_css" );
		grunt.task.run( "clean:" + assetBundlerTaskPrefix + "_tmpl" );
		grunt.task.run( "buildKeepSeparateBundlesHelper" );

	} );

	grunt.registerTask( "buildPageBundles", "Builds the bundles for each page", function() {

		this.requires( "buildBundleAndPageJSONs:prod" );

		//var pageMap = grunt.config.get( "pageMap" );
		grunt.config.set( "pages", _.keys( pageMap ) );
		grunt.task.run( "buildPageBundlesHelper" );
	} );

	grunt.registerTask( "buildPageBundlesHelper", "", function() {

		var pages = grunt.config.get( "pages" );
		//var pageMap = grunt.config.get( "pageMap" );
		//var bundleMap = grunt.config.get( "bundleMap" );

		if( pages.length === 0 ) return;

		var pageMetadata = pageMap[ pages.pop() ];

		grunt.config.set( "pages", pages );

		var pageDir = pageMetadata.name.replace(/\/[^\/]*$/,"/");
		var pageName = pageMetadata.name.substring( pageMetadata.name.lastIndexOf( "/" ) + 1);

		var files = [];

		var bundlesIncorporatedIntoCombined = [];

		var filesAlreadyInKeepSeparate = [];

		_.each( pageMetadata.requiredBundles, function( bundleName ) {

			var bundle = bundleMap[ bundleName ];

			if( ! bundle.keepSeparate ) {
				files = _.union( files, _.map( bundle.files, function( file ) {
					//return "{ASSET_LIBRARY}/" + file;
					return resolveAssetFilePath( file );
				} ) );
				bundlesIncorporatedIntoCombined.push( bundleName );
			}
			else {
				filesAlreadyInKeepSeparate = _.union( filesAlreadyInKeepSeparate, _.map( bundle.files, function( file ) {
					return resolveAssetFilePath( file );
				} ) );
			}

		} );

		files = _.difference( files, filesAlreadyInKeepSeparate );

		files = _.union( files, _.map( pageMetadata.files, function( file ) {

			//return "{APP_PAGES}/" + file;
			return resolveAssetFilePath( file );

		} ) );

		var filesToConcatCSS = [];
		var filesToConcatJS = [];
		var filesToConcatTMPL = [];

		//grunt.log.writeln( "concatenating files: " + files.join(", ") );

		_.each( files, function( file ) {

			//var realFileName = file.replace( "{APP_PAGES}/", grunt.config.get( "appPagesDest") ).replace( "{ASSET_LIBRARY}/", grunt.config.get( "assetLibraryDest") );
			var realFileName = resolveAssetFilePath( file );

			//grunt.log.writeln( "realFileName: " + realFileName );
			if( _s.endsWith( file, ".css" ) )
				filesToConcatCSS.push( realFileName );
			else if ( _s.endsWith( file, ".js" ) )
				filesToConcatJS.push( realFileName );
			else if( _s.endsWith( file, ".tmpl" ) )
				filesToConcatTMPL.push( realFileName );
		} );

		var combinedPagePrefix = pageDir + pageName + "_combined";
		var combinedPagePrefixForPageMap = "{APP_PAGES}/" + combinedPagePrefix;

		pageMetadata.files = [ combinedPagePrefixForPageMap + ".js", combinedPagePrefixForPageMap + ".css", combinedPagePrefixForPageMap + ".tmpl" ];

		pageMetadata.requiredBundles = _.difference( pageMetadata.requiredBundles, bundlesIncorporatedIntoCombined );

		grunt.config.set( "filesToConcatJS", filesToConcatJS );
		grunt.config.set( "filesToConcatCSS", filesToConcatCSS );
		grunt.config.set( "filesToConcatTMPL", filesToConcatTMPL );

		grunt.config.set( "filesToCleanJS", filesToConcatJS );
		grunt.config.set( "filesToCleanCSS", filesToConcatCSS );
		grunt.config.set( "filesToCleanTMPL", filesToConcatTMPL );

		grunt.config.set( "concatedFileDestJS", options.appPages.destDir + combinedPagePrefix + ".js" );
		grunt.config.set( "concatedFileDestCSS", options.appPages.destDir + combinedPagePrefix + ".css" );
		grunt.config.set( "concatedFileDestTMPL", options.appPages.destDir + combinedPagePrefix + ".tmpl" );

		grunt.task.run( "concat:" + assetBundlerTaskPrefix + "_js" );
		grunt.task.run( "concat:" + assetBundlerTaskPrefix + "_css" );
		grunt.task.run( "concat:" + assetBundlerTaskPrefix + "_tmpl" );

		grunt.task.run( "clean:" + assetBundlerTaskPrefix + "_js" );
		grunt.task.run( "clean:" + assetBundlerTaskPrefix + "_css" );
		grunt.task.run( "clean:" + assetBundlerTaskPrefix + "_tmpl" );

		grunt.task.run( "buildPageBundlesHelper" );

		//grunt.config.set( "pageMap", pageMap );

	} );


	grunt.registerTask( "resolveAndInjectDependencies", "", function() {

		//var pageMap = grunt.config.get( "pageMap" );

		assetBundlerUtil.resolveAndInjectDependencies(
			bundleMap,
			pageMap,
			grunt.config.get( "configOptions"),
			options.rootDir,
			options.staticDir );

		//grunt.config.set( "pageMap", pageMap );

	} );

	grunt.registerTask( "saveBundleAndPageJSONs", "Persist the page and bundle JSONs", function() {

		assetBundlerUtil.saveBundleMap( bundleMap );
		assetBundlerUtil.savePageMap( pageMap );

	} );

	grunt.registerTask( "replaceBundlerDirTokens", "", function() {

		function replaceStringInFile( fileName, matchString, replaceString ) {
			var fileContents = fs.readFileSync( fileName ).toString();
			fileContents = fileContents.replace( matchString, replaceString );
			fs.writeFileSync( fileName, fileContents );
		}

		var assetLibraryFiles = _.filter( findit.sync( options.assetLibrary.destDir ), assetBundlerUtil.isAssetFile );
		_.each( assetLibraryFiles, function( fileName ) {
			replaceStringInFile( fileName, /#bundler_dir/g, fileName.replace( options.assetLibrary.destDir, "").replace(/\/[^\/]*$/, "" ) );
		} );

		var appPagesFiles = _.filter( findit.sync( options.appPages.destDir ), assetBundlerUtil.isAssetFile );
		_.each( appPagesFiles, function( fileName ) {
			replaceStringInFile( fileName, /#bundler_dir/g, fileName.replace( options.appPages.destDir, "").replace(/\/[^\/]*$/, "" ) );
		} );

	} );

};
