var hxlBites = {

	//variable data is stored in
	_data: [],

	//variable unfiltered timeseries data stored in
	_fullData: [],

	//identifying whether a dataset is a timeseries
	timeSeries: false,
	timeSeriesFilter: '',
	timeSeriesFilterHeader: '',

	//function to set data and check is data is a timeseries
	data: function(data){
		this._data = data;
		this._fullData = data;
		this._data = this.checkTimeSeriesAndFilter(data);
		return this;
	},

	//check if data is a timeseries
	checkTimeSeriesAndFilter: function(data){
		let self = this;
		
		//get values for tags that match
		let matches = self._getIngredientValues({'name':'#date','tags':['#date-update','#date-report','#date-start','#date-occurred']},self._data);
		let timeSeries = true;
		
		//tracking which column to filter on and by what value
		let filterValue='';
		let filterHeader = '';
		let filterCol = 0;
		
		//check if any date columns
		if(matches.length==0){
			timeSeries = false;
		} else {
			[timeSeries,filterValue,filterHeader,filterCol] = self._checkColumnMatchesForTimeSeries(matches);
		}
		//if time series data is found filter for last date
		if(timeSeries){
			let headers = data.slice(0, 2);
			data = data.slice(2,data.length);
			data = self._filterData(data,filterCol,filterValue);
			data = headers.concat(data);
		}
		//global time series 
		self.timeSeries = timeSeries;
		self.timeSeriesFilter = filterValue;
		self.timeSeriesFilterHeader = filterHeader;
		return data;
	},

	//loops through matches and returns first timeseries
	_checkColumnMatchesForTimeSeries: function(matches){
		let self = this;
		timeSeries = [];
		/*let filterValue='';
		let filterHeader = '';
		let filterCol = 0;*/
		let filterValue=[];
		let filterHeader = [];
		let filterCol = [];

		//loop through every match
		matches.forEach(function(match,i){
			timeSeries.push(true);
			filterValue.push('');
			filterHeader.push('');
			filterCol.push(0);
			//keyvalue of date plus count of occurences
			let keyValues = self._varFuncKeyValue(match);
			//check there enough unique values to be a time series
			let length = keyValues.length;
			var lastValue = keyValues[length-1].value;
			// lastvalue>3
			//sort alphabetically (assumes date in YYYY-MM-DD format currently)
			keyValues = keyValues.sort(function(a,b){
				if (a.key < b.key)
    				return -1;
  				if (a.key > b.key)
    				return 1;
  				return 0;
			});
			var values = keyValues.map(function(d){return new Date(d.key)});
			var diffs = diff(values);
			
			if(length<5){
				timeSeries[i] = false;
			} else {
				var sd = stddev(diffs);
				if(sd<0.6|| lastValue>2){
					//filter for latest date from sort, needs fix for right filter
					if(filterValue==''){
						/*filterValue = keyValues[length-1].key;
						filterCol = match.col;
						filterHeader = match.header;*/
						filterValue[i] = keyValues[length-1].key;
						filterCol[i] = match.col;
						filterHeader[i] = match.header;											
					}
				} else {
					timeSeries[i] = false;
				}
			}
		});
		for(var i = 0;i<timeSeries.length;i++){
			if(timeSeries[i]){
				return [timeSeries[i],filterValue[i],filterHeader[i],filterCol[i]];
			}
		}
		return [false,'','',0];

		function diff(arr){
			var output = [];
			for(var i=1;i<arr.length;i++){
				var oneDay = 24*60*60*1000; // hours*minutes*seconds*milliseconds
				var firstDate = arr[i];
				var secondDate = arr[i-1];

				var diff = Math.round(Math.abs((firstDate.getTime() - secondDate.getTime())/(oneDay)));
				if(!isNaN(diff)){
					output.push(diff);
				}			
			}
			return output;
		}

		function stddev(array){
			n = array.length;
			if(n>0){
				mean = array.reduce((a,b) => a+b)/n;
				s = Math.sqrt(array.map(x => Math.pow(x-mean,2)).reduce((a,b) => a+b)/n);
				return s;
			}
			return 100;
		}
	},

	getTextBites: function(){
		let self = this;
		let bites = [];
		bites = bites.concat(self.getTextBitesMain(self._data,self.timeSeries));
		if(self.timeSeries){
			bites = bites.concat(self.getTextBitesMain(self._fullData,false));
		}
		return bites;
	},	

	getTextBitesMain: function(data,timeSeries){
		let self = this;
		let bites = [];
		if(this.timeSeries){
			bites.push({'type':'text','subtype':'datefilter','priority':10,'bite':'Data filtered on '+this.timeSeriesFilterHeader+' for '+this.timeSeriesFilter, 'id':'text0000'});
		}
		this._textBites.forEach(function(bite,i){
			let distinctOptions = {};
			bite.ingredients.forEach(function(ingredient){
				distinctValues = self._getIngredientValues(ingredient,data);
				distinctOptions[ingredient.name] = distinctValues;
			});
			let matchingValues = self._checkCriteria(bite.criteria,distinctOptions);
			if(matchingValues !== false){
				let uniqueIDs = []
				bite.ingredients.forEach(function(ingredient){
					matchingValues[ingredient.name].forEach(function(match){
						if(timeSeries){
							uniqueIDs.push(bite.id+'/'+match.tag+'/'+match.col+'/timefilter');
						} else {
							uniqueIDs.push(bite.id+'/'+match.tag+'/'+match.col);
						}
					})
				});
				let variables = self._getVariables(bite,matchingValues);
				let newBites = self._generateTextBite(bite.phrase,variables);
				newBites.forEach(function(newBite,i){
					bites.push({'type':'text','subtype':bite.subType,'priority':bite.priority,'bite':newBite, 'id':bite.id,'uniqueID':uniqueIDs[i]});
				});
				
			}
		});
		return bites;
	},

	getTableBites: function(){
		let self = this;
		let bites = [];
		this._tableBites.forEach(function(bite,i){
			let distinctOptions = {};
			bite.ingredients.forEach(function(ingredient){
				distinctValues = self._getIngredientValues(ingredient,self._data);
				distinctOptions[ingredient.name] = distinctValues;
			});
			let matchingValues = self._checkCriteria(bite.criteria,distinctOptions);
			if(matchingValues !== false){
				let titleVariables = self._getTitleVariables(bite.variables,matchingValues);				
				let titles = self._generateTextBite(bite.title,titleVariables);
				let variables = self._getTableVariablesWithMatching(self._data,bite,matchingValues);
				let newBites = self._generateTableBite(bite.table,variables);
				newBites.forEach(function(newBite,i){
					bites.push({'type':'table','subtype':bite.subType,'priority':bite.priority,'bite':newBite.bite, 'uniqueID':newBite.uniqueID, 'id':bite.id, 'title':titles[i]});
				});				
			}			
		});
		return bites;
	},

	getCrossTableBites: function(){
		let self = this;
		let bites = [];
		this._crossTableBites.forEach(function(bite,i){
			let distinctOptions = {};
			bite.ingredients.forEach(function(ingredient){
				distinctValues = self._getIngredientValues(ingredient,self._data);
				distinctOptions[ingredient.name] = distinctValues;
			});
			let matchingValues = self._checkCriteria(bite.criteria,distinctOptions);
			if(matchingValues !== false){
				let titleVariables = self._getTitleVariables(bite.variables,matchingValues);				
				let titles = self._generateTextBite(bite.title,titleVariables);
				let variables = self._getCrossTableVariables(self._data,bite,matchingValues);
				let newBite = self._generateCrossTableBite(bite.table,variables);
				bites.push({'type':'crosstable','subtype':bite.subType,'priority':bite.priority,'bite':newBite.bite, 'uniqueID':newBite.uniqueID, 'id':bite.id, 'title':titles[0]});
			}			
		});
		return bites;
	},	

	getChartBites: function(){
		let self = this;
		let bites = [];
		bites = bites.concat(self.getChartBitesMain(self._data,self.timeSeries));
		if(self.timeSeries){
			bites = bites.concat(self.getChartBitesMain(self._fullData,false));
		}
		return bites;
	},	

	getChartBitesMain: function(data,timeseries){

		let self = this;
		let bites = [];
		this._chartBites.forEach(function(bite,i){
			let distinctOptions = {};
			bite.ingredients.forEach(function(ingredient){
				distinctValues = self._getIngredientValues(ingredient,data);
				distinctOptions[ingredient.name] = distinctValues;
			});
			let matchingValues = self._checkCriteria(bite.criteria,distinctOptions);
			if(matchingValues !== false){
				//let titleVariables = self._getTitleVariables(bite.variables,matchingValues);				
				//let titles = self._generateTextBite(bite.title,titleVariables);
				let variables = self._getTableVariablesWithMatching(data,bite,matchingValues,timeseries);
				let newBites = self._generateChartBite(bite.chart,variables);
				newBites.forEach(function(newBite,i){
					bites.push({'type':'chart','subtype':bite.subType,'priority':bite.priority,'bite':newBite.bite, 'id':bite.id, 'uniqueID':newBite.uniqueID, 'title':newBite.title});
				});		
			}			
		});
		return bites;
	},

	getTimeSeriesBites: function(){

		let self = this;
		let bites = [];

		if(!self.timeSeries){
			return [];
		}

		// through all timeSeriesBites and check criteria
		this._timeSeriesBites.forEach(function(bite,i){

			//get unique values for each ingredient for checking against bite criteria
			let distinctOptions = {};
			bite.ingredients.forEach(function(ingredient){
				distinctValues = self._getIngredientValues(ingredient,self._fullData);
				distinctOptions[ingredient.name] = distinctValues;
			});

			//return just the ingredients that match the criteria of the bite
			let matchingValues = self._checkCriteria(bite.criteria,distinctOptions);

			//skip if no values match
			if(matchingValues !== false){

				//get all the combinations of matching values with their data table
				let variables = self._getTableVariablesWithMatching(self._fullData,bite,matchingValues);
				//turning date strings into date objects

				variables = self._formatTimeSeriesVariables(variables);
				//construct bite from chart bite
				let newBites = self._generateChartBite(bite.chart,variables);
				newBites.forEach(function(newBite,i){

					//sort by date
					let headers = newBite.bite.slice(0, 1);
					data = newBite.bite.slice(1,newBite.bite.length);
					data = data.sort(function(a,b){
						return a[0] - b[0];
					});
					newBite.bite = headers.concat(data);
					bites.push({'type':'chart','subtype':bite.subType,'priority':bite.priority,'bite':newBite.bite, 'id':bite.id, 'uniqueID':newBite.uniqueID, 'title':newBite.title});
				});		
			}

		});
		return bites;
	},

	getMapBites: function(){
		let self = this;
		let bites = [];
		bites = bites.concat(self.getMapBitesMain(self._data,self.timeSeries));
		if(self.timeSeries){
			bites = bites.concat(self.getMapBitesMain(self._fullData,false));
		}
		return bites;
	},

	getMapBitesMain: function(data,timeseries){

		let self = this;
		let bites = [];
		this._mapBites.forEach(function(bite,i){
			let distinctOptions = {};
			bite.ingredients.forEach(function(ingredient){
				distinctValues = self._getIngredientValues(ingredient,self._data);
				distinctOptions[ingredient.name] = distinctValues;
			});
			let matchingValues = self._checkCriteria(bite.criteria,distinctOptions);
			if(matchingValues !== false){
				if(bite.subType=='point'){
					var variables = self._getTableVariablesForPoint(self._data,bite,matchingValues);
				} else {
					var variables = self._getTableVariablesWithMatching(self._data,bite,matchingValues,timeseries);
				}
				let newBites = self._generateMapBite(bite.map,variables);
				newBites.forEach(function(newBite,i){
					bites.push({'type':'map','subtype':bite.subType,'title': newBite.title,'priority':bite.priority,'bite':newBite.bite, 'uniqueID':newBite.uniqueID, 'id':bite.id, 'geom_url':newBite.geom_url,'geom_attribute':newBite.geom_attribute,'name_attribute':newBite.name_attribute});
				});
			}		
		});
		return bites;
	},

	_formatTimeSeriesVariables: function(variables){
		variables.forEach(function(variable,j){
			variable.table[0].forEach(function(d,i){
				if(i>0){
					variables[j].table[0][i] = new Date(d);
				}
			});
		});
		return variables;
	},

	_getTitleVariables: function(variables,matchingValues){
		let titleVariables = [];
		let length = matchingValues[variables[0]].length;
		for(var pos = 0;pos<length;pos++){
			variables.forEach(function(v,i){
				if(pos==0){
					titleVariables.push([]);
				}
				if(v.indexOf('(')==-1){
					let header = '';
					if(i==0){
						header = matchingValues[v][pos].header;
					} else {
						header = matchingValues[v][0].header;
					}
					titleVariables[i].push(header);
				} else if (v!='count()') {
					var variable = v.substring(v.indexOf('(')+1,v.indexOf(')'));
					let header = '';
					if(i==0){
						header = matchingValues[variable][pos].header;
					} else {
						header = matchingValues[variable][0].header;
					}
					titleVariables[i].push(header);
				} else {
					titleVariables[i].push('');
				}
			});
		}	
		return titleVariables;
	},		

	_getIngredientValues: function(ingredient,data){
		let ingredientDistinct = [];
		let dataset = hxl.wrap(data);
		dataset.withColumns(ingredient.tags).forEach(function(row,col,rowindex){				
			row.values.forEach(function(value,index){
				//At the moment only include first tag that meets requirement.
				if(index>-1){
					if(rowindex==0){
						ingredientDistinct[index] = {'tag':'','header':'','uniqueValues':[],'values':[],'col':''};
						ingredientDistinct[index].tag = col.displayTags[index];
						ingredientDistinct[index].header = col.headers[index];
						ingredientDistinct[index].col = data[0].indexOf(ingredientDistinct[index].header);
					}
					if(ingredientDistinct[index].uniqueValues.indexOf(value)==-1){
						ingredientDistinct[index].uniqueValues.push(value);
					}
					ingredientDistinct[index].values.push(value);
				}						
			});
		});
		return ingredientDistinct;
	},

	_checkCriteria: function(criteria,ingredientValues){
		let self = this;
		criteria.forEach(function(criterion){
			parsedCriterion = self._parseCriterion(criterion);
			ingredientValues = self._filterForMatches(parsedCriterion,ingredientValues);
		});
		for(key in ingredientValues){
			if(ingredientValues[key].length==0){
				return false;
			}
		}		
		return ingredientValues;
	},

	_parseCriterion: function(criterion){
		let operations = ['<','>','!'];
		let operation = -1;
		operations.forEach(function(op){
			if(criterion.indexOf(op)>-1){
				operation = op;
			}
		});
		if(operation != -1){
			let parse = criterion.split(operation);
			let variable = parse[0].trim();
			let value = parse[1].trim();
			return {'variable':variable,'operation':operation,'value':value};			
		} else {
			return 'Failed to parse';
		}
	},

	_filterForMatches: function(criterion,ingredientValues){
		ingredientValues[criterion.variable] = ingredientValues[criterion.variable].filter(function(distinctValues,i){
			if(criterion.operation=='<'){
				if(!(distinctValues.uniqueValues.length < criterion.value)){
					return false;
				}
			}
			if(criterion.operation=='>'){
				if(!(distinctValues.uniqueValues.length > criterion.value)){
					return false;
				}		
			}
			return true;
		});
		if(criterion.operation == '!'){
			if(ingredientValues[criterion.variable].length==0){
				ingredientValues[criterion.variable].push({tag: "#value", header: "Placeholder", uniqueValues: [], values: [], col: -1});
			} else {
				ingredientValues[criterion.variable] = [];
			}
		}
		return ingredientValues;
	},
	//this function is overwritten, why? check lat lon is working otherwise delete
	_getTableVariablesWithMatching: function(data,bite,matchingValues,timeseries = false){
		let table = [['lat','lon',data[1],data[0]]];
		matchingValues['lat'][0].values.forEach(function(d,i){
			let row = [d,matchingValues['lon'][0].values[i],data[i+2]];
			table.push(row);
		});
		let uniqueID = bite.id + '/' + matchingValues['lat'][0].tag + '/' + matchingValues['lat'][0].col +'/'+ matchingValues['lon'][0].tag + '/' + matchingValues['lon'][0].col
		return [{'table':table,'uniqueID':uniqueID,'title':bite.title}]
	},

	_getTableVariablesWithMatching: function(data,bite,matchingValues,timeseries = false){

		//needs large efficieny improvements
		let self = this;
		let tables = [];
		let keyMatches = matchingValues[bite.variables[0]];
		keyMatches.forEach(function(keyMatch){
			let table = [];
			let keyValues = self._varFuncKeyValue(keyMatch);
			let firstCol = [keyMatch.header];
			keyValues.forEach(function(keyValue){
				firstCol.push(keyValue.key); 
			});
			var workingTables = [[]];
			workingTables[0].push(firstCol);
			var idMatches = [[]];
			var headerMatches = [[]];
			bite.variables.forEach(function(variable,index){
				if(index>0){
					if(variable.indexOf('(')>-1){
						let col = new Array(firstCol.length).fill(0);
						let func = variable.split('(')[0];
						if(func == 'count'){
							col[0] = 'Count';
							keyValues.forEach(function(keyValue,index){
								col[index+1] = keyValue.value;
							});
							workingTables.forEach(function(table,i){
								workingTables[i].push(col);
							});
						}
						if(func == 'countDistinct'){
							let sumValue = variable.split('(')[1].split(')')[0];
							var newWorkingTables = [];
							var newIDMatches = [];
							var newHeaderMatches = [];
							var length = matchingValues[sumValue].length;
							for (i = 0; i < length; i++){
								newWorkingTables = newWorkingTables.concat(JSON.parse(JSON.stringify(workingTables)));
								newIDMatches = newIDMatches.concat(JSON.parse(JSON.stringify(idMatches)));
								newHeaderMatches = newIDMatches.concat(JSON.parse(JSON.stringify(headerMatches)));
							}
							workingTables = JSON.parse(JSON.stringify(newWorkingTables));
							idMatches = JSON.parse(JSON.stringify(newIDMatches));
							headerMatches = JSON.parse(JSON.stringify(newHeaderMatches));
							matchingValues[sumValue].forEach(function(match, ti){
								let col = new Array(firstCol.length).fill(0);
								idMatches.forEach(function(idMatch,i){
									if(i % length==ti){
										idMatches[i].push({'tag':match.tag,'col':match.col});
										headerMatches[i].push(match.header);
									}
								});
								col[0] = 'Value';
								firstCol.forEach(function(value,index){
									if(index>0){
										let filteredData = self._filterData(data,keyMatch.col,value);
										let sum = [];
										filteredData.forEach(function(row,index){
											let value = row[match.col];
											if(sum.indexOf(value)==-1){
												sum.push(value);
											}							
										});
										col[index] = sum.length;
									}
								});
								workingTables.forEach(function(table,i){
									if(i % length==ti){
										workingTables[i].push(col);
									}
								});								
							});	
						}
						if(func == 'sum'){
							let sumValue = variable.split('(')[1].split(')')[0];
							var newWorkingTables = [];
							var newIDMatches = [];
							var newHeaderMatches = [];
							var length = matchingValues[sumValue].length;
							for (i = 0; i < length; i++){
								newWorkingTables = newWorkingTables.concat(JSON.parse(JSON.stringify(workingTables)));
								newIDMatches = newIDMatches.concat(JSON.parse(JSON.stringify(idMatches)));
								newHeaderMatches = newIDMatches.concat(JSON.parse(JSON.stringify(headerMatches)));
							}
							workingTables = JSON.parse(JSON.stringify(newWorkingTables));
							idMatches = JSON.parse(JSON.stringify(newIDMatches));
							headerMatches = JSON.parse(JSON.stringify(newHeaderMatches));
							matchingValues[sumValue].forEach(function(match, ti){
								let col = new Array(firstCol.length).fill(0);
								idMatches.forEach(function(idMatch,i){
									if(i % length==ti){
										idMatches[i].push({'tag':match.tag,'col':match.col});
										headerMatches[i].push(match.header);
									}
								});
								col[0] = 'Value';
								firstCol.forEach(function(value,index){
									if(index>0){
										let filteredData = self._filterData(data,keyMatch.col,value);
										let sum = 0;
										filteredData.forEach(function(row,index){
											let value = Number(row[match.col]);
											if(value!=NaN){
												sum += value;
											}									
										});
										col[index] = sum;
									}
								});
								workingTables.forEach(function(table,i){
									if(i % length==ti){
										workingTables[i].push(col);
									}
								});								
							});					
						}					
					} else {
						// use this code for sums!
						let match = matchingValues[variable][0];
						let col = new Array(firstCol.length).fill(0);
						idMatches.forEach(function(idMatch,i){						
							idMatches[i].push({'tag':match.tag,'col':match.col});
							headerMatches[i].push(match.header);
						})
						col[0] = match.header;
						firstCol.forEach(function(value,index){
							if(index>0){
								let filteredData = self._filterData(data,keyMatch.col,value);
								let uniques = [];
								filteredData.forEach(function(row,index){
									let value = row[match.col];
									if(uniques.indexOf(value)==-1){
										uniques.push(value);
									}
								});
								col[index] = uniques.length;
							}
						});
						workingTables.forEach(function(table,i){
							workingTables[i].push(col);
						});
					}					
				}
			});
			workingTables.forEach(function(table,i){
				var uniqueID = bite.id+'/'+keyMatch.tag+'/'+keyMatch.col;
				var titleVars = [[keyMatch.header]];
				idMatches[i].forEach(function(d){
					uniqueID = uniqueID + '/'+d.tag+'/'+d.col;
				})
				if(timeseries){
					uniqueID+='/timefilter';
				}				
				headerMatches[i].forEach(function(header){
					titleVars.push([header]);
				});

				var titles = self._generateTextBite(bite.title,titleVars);
				if(timeseries){
					titles[0] = titles[0] + ' for '+self.timeSeriesFilter;
				}
				tables.push({'table':table,'uniqueID':uniqueID,'title':titles[0]});
			});
		});
		return tables;
	},

	_getCrossTableVariables: function(data,bite,matchingValues){

		//needs large efficieny improvements
		let self = this;
		let table = [];
		let keyMatch1 = matchingValues[bite.variables[0]][0];
		let keyValues1 = this._varFuncKeyValue(keyMatch1);
		let keyMatch2 = matchingValues[bite.variables[1]][0];
		let keyValues2 = this._varFuncKeyValue(keyMatch2);
		let firstCol = [''];
		keyValues1.forEach(function(keyValue){
			firstCol.push(keyValue.key); 
		});
		let maxCount = data.length;
		table.push(firstCol);
		keyValues2.forEach(function(keyValue,index){
			let col = new Array(firstCol.length).fill(0);
			col[0] = keyValue.key;
			firstCol.forEach(function(value,index){
				if(index>0){
					let filteredData = self._filterData(data,keyMatch1.col,value);
					let maxRowCount = filteredData.length;
					filteredData = self._filterData(filteredData,keyMatch2.col,keyValue.key);
					let func = bite.variables[2].split('(')[0];
					if(func == 'percentCount'){
						col[index] = (filteredData.length/maxCount*100).toFixed(2);;
					}
					if(func == 'percentRowCount'){
						col[index] = (filteredData.length/maxRowCount*100).toFixed(2);;
					}
					if(func == 'count'){
						col[index] = filteredData.length;
					}
					if(func == 'sum'){
						let sumValue = bite.variables[2].split('(')[1].split(')')[0];
						let match = matchingValues[sumValue][0];
						let sum = 0;
						filteredData.forEach(function(row,index){
							let value = Number(row[match.col]);
							if(value!=NaN){
								sum += value;
							}									
						});
						col[index] = sum;					
					}
				}						
			});					
			table.push(col);
		});
		return {'table':table,'uniqueID':bite.id+'/'+keyMatch1.tag+'/'+keyMatch1.col+'/'+keyMatch2.tag+'/'+keyMatch2.col};
	},

	_filterData: function(data,col,value){
		let filterData = data.filter(function(d,index){
			if(d[col]==value){
				return true;
			} else {
				return false;
			}
		});
		return filterData;
	},

	_getVariables: function(bite,matchingValues){

		let self = this;
		variableList = [];
		bite.variables.forEach(function(variable){
			let func = variable.split('(')[0];
			let ingredient = variable.split(')')[0].split('(')[1];
			let items=[];
			if(func == 'total'){
				items.push(self._data.length-2);
			} else {
				matchingValues[ingredient].forEach(function(match){
					if(func == 'count'){
						items.push(self._varFuncCount(match));
					}
					if(func == 'single'){
						items.push(self._varFuncSingle(match));
					}
					if(func == 'header'){
						items.push(self._varFuncHeader(match));
					}
					if(func == 'tag'){
						items.push(self._varFuncTag(match));
					}
					if(func == 'list'){
						items.push(self._varFuncList(match));
					}
					if(func == 'listOrCount'){
						items.push(self._varFuncListOrCount(match));
					}
					if(func == 'first'){
						items.push(self._varFuncSortPosition(match,0));
					}
					if(func == 'firstCount'){
						items.push(self._varFuncSortPositionCount(match,0));
					}
					if(func == 'second'){
						items.push(self._varFuncSortPosition(match,1));
					}
					if(func == 'secondCount'){
						items.push(self._varFuncSortPositionCount(match,1));
					}
					if(func == 'sum'){
						items.push(self._varFuncSum(match));
					}									
				});
			}
			variableList.push(items);
		});
		return variableList;
	},

	_checkMapCodes: function(level,values){

		worldgeos = hxlBites._mapValues.world;
		codCodes = hxlBites._mapValues.cod;

		/*var urlPattern = "https://gistmaps.itos.uga.edu/arcgis/rest/services/COD_External/{{country}}_pcode/MapServer/{{level}}/query?where=1%3D1&outFields=*&f=geojson";
        var url = urlPattern.replace("{{country}}", countryCode.toUpperCase());
        url = url.replace("{{level}}", levelId);*/
		if(level==0){
			let maxMatch = 0;
			let maxURL = '';
			let maxName = '';
			let maxCode = '';
			worldgeos.forEach(function(geomMeta){
				geomMeta.codes.forEach(function(code){
					let match = 0;
					values.forEach(function(value,i){
						if(code.values.indexOf(value.toUpperCase())>-1){
							match++;
						}
					});
					if(match>maxMatch){
						maxMatch=match;
						maxURL = geomMeta.url;
						maxName = geomMeta.name;
						maxCode = code.name;
					}
				});
			});
			//let matchPercent = maxMatch/values.length;
			//let unmatched = values.length - maxMatch;
			return {'code':[maxCode],'name':maxName,'url':[maxURL],'clean':[],'name_att':['NAME']};
		}
		if(level>0){
			let iso3Codes = [];
			let pcodeClean = [];
			let parsed = [];
			var url = '';
			var adjustment = '';
			values.forEach(function(d){
				let iso3 = isNaN(d.substring(2,3));
				if(iso3){
					countryCode = d.substring(0,3);
				} else {
					countryCode = d.substring(0,2);
				}
				if(parsed.indexOf(countryCode)==-1){
					parsed.push(countryCode);
					if(iso3){
						codCodes.forEach(function(code){
							if(code.iso3==countryCode && code.levels.indexOf(level)>-1){
								iso3Codes.push(code);
								if(code.iso3!=code.use){
									pcodeClean.push([code.iso3,code.use]);
								}
							}
						});
					} else {
						codCodes.forEach(function(code){
							if(code.iso2==countryCode && code.levels.indexOf(level)>-1){
								iso3Codes.push(code);
								if(code.iso2!=code.use){
									pcodeClean.push([code.iso2,code.use]);
								}
							}
						});						
					}
				}
			})
			let urls = [];
			let codes = [];
			let name_atts = [];
			let urlPattern = "https://gistmaps.itos.uga.edu/arcgis/rest/services/COD_External/{{country}}_pcode/MapServer/{{level}}/query?where=1%3D1&outFields=*&f=geojson";
			if(iso3Codes.length>0){
				iso3Codes.forEach(function(d){
			        var url = d.url.replace(/{{country}}/g, d.iso3.toUpperCase());
			        url = url.replace("{{level}}", level+d.adjustment);
			        urls.push(url);
			        var code = d.code_att.replace("{{level}}", level);
			        var name_att = d.name_att.replace("{{level}}", level);
			        codes.push(code);
			        name_atts.push(name_att);
				});
				return {'code':codes,'name':'cod','url':urls,'clean':pcodeClean,'name_att':name_atts};			
			}
			return false;
					
		}
		return false

	},

	//change later to form every iteration
	_generateTextBite: function(phrase,variables){
		let length = variables[0].length;
		let bites = [];
		for(var pos = 0;pos<length;pos++){
			phraseSplit = phrase.split('{');
			phraseParts = phraseSplit.map(function(part,i){
				if(i>0){
					let numString = part.substring(0,1);;
					let varNum = parseInt(numString);
					let matchString = numString + '}';
					part = part.replace(numString+'}',variables[varNum-1][pos]);
				}
				return part;
			});
			let bite  = '';
			phraseParts.forEach(function(part){
				bite += part;
			});
			bites.push(bite);
		}
		return bites
	},

	_generateTableBite: function(table,variables){
		let length = variables.length;
		let bites = [];
		for(var pos = 0;pos<length;pos++){
			let tableData = this._transposeTable(variables[pos].table);
			if(table.length>0){
				let func=table.split('(')[0];
				if(func=='rows'){
					let value = parseInt(table.split('(')[1].split(')')[0]);
					tableData = tableData.filter(function(row,i){
						if(i<value+1){
							return true;
						} else {
							return false;
						}
					}) ;
				}
			}
			let bite = {'bite':tableData,'uniqueID':variables[pos].uniqueID};
			bites.push(bite);
		}
		return bites;
	},

	_generateCrossTableBite: function(table,variables){
		let tableData = this._transposeTable(variables.table);
		if(table.length>0){
			let func=table.split('(')[0];
			if(func=='rows'){
				let value = parseInt(table.split('(')[1].split(')')[0]);
				tableData = tableData.filter(function(row,i){
					if(i<value+1){
						return true;
					} else {
						return false;
					}
				}) ;
			}
		}
		let bite = tableData;
		return {'bite':bite,'uniqueID':variables.uniqueID};
	},	

	_generateChartBite: function(chart,variablesList){
		let self = this;
		let bites = [];
		variablesList.forEach(function(variables){
			let chartData = self._transposeTable(variables.table);
			if(chart.length>0){
				let func=chart.split('(')[0];
				if(func=='rows'){
					let value = parseInt(chart.split('(')[1].split(')')[0]);
					var topRow = chartData.shift();
					chartData.sort(function(a,b){
						return b[1] - a[1];
					});
					chartData.unshift(topRow);					
					chartData = chartData.filter(function(row,i){
						if(i<value+1){
							return true;
						} else {
							return false;
						}
					});
				}
			}
			let bite = {'bite':chartData,'uniqueID':variables.uniqueID,'title':variables.title};
			bites.push(bite);
		});
		return bites
	},

	_generateMapBite: function(map,variables){
		let self = this;
		let bites = [];
		variables.forEach(function(v){
			let mapData = self._transposeTable(v.table);
			let tag = v.uniqueID.split('/')[1];
			let location = null;
			let level = -1;

			//improve tag detection, doesn't work if extra attributes are included

			if(tag=='#country+code'){
				level = 0;
			}
			if(tag=='#adm1+code'){
				level = 1;
			}
			if(tag=='#adm2+code'){
				level = 2;
			}
			if(tag=='#adm3+code'){
				level = 3;
			}
						
			if(level>-1){
				values = v.table[0].slice(1, v.table[0].length);
				let mapCheck = self._checkMapCodes(level,values);
				if(mapCheck){
					mapCheck.clean.forEach(function(c){
						mapData.forEach(function(d){
							d[0] = d[0].replace(c[0],c[1]);
						});
					});
					mapData.forEach(function(d){
						d[0] = d[0].toUpperCase();
					});
					let bite = {'bite':mapData,'uniqueID':v.uniqueID,'title':v.title,'geom_attribute':mapCheck.code,'geom_url':mapCheck.url,'name_attribute':mapCheck.name_att};
					bites.push(bite);
				}
			}
			if(tag=='#geo+lat'){
				let bite = {'bite':mapData,'uniqueID':v.uniqueID,'title':v.title,'geom_attribute':'','geom_url':'','name_attribute':''};
				bites.push(bite);
			}
		});
		return bites;
	},

	_transposeTable: function(table){

		let newTable = [];
		let length = table[0].length;
		for(var i =0;i<table[0].length;i++){
			let row = [];
			table.forEach(function(col){
				row.push(col[i]);
			});
			newTable.push(row);
		}
		return newTable;
	},

	_varFuncCount: function(match){
		return '<span class="hbvalue">'+match.uniqueValues.length+'</span>';
	},

	_varFuncSum: function(match){
		var sum = match.values.reduce((a, b) => a + (isNaN(Number(b)) ? 0 : Number(b)), 0);
		return '<span class="hbvalue">'+sum+'</span>';
	},	

	_varFuncSingle: function(match){
		return '<span class="hbvalue">'+match.uniqueValues[0]+'</span>';
	},

	_varFuncHeader: function(match){
		return '<span class="hbheader">' + match.header + '</span>';
	},

	_varFuncTag: function(match){
		return '<span class="hbtag">' + match.tag + '</span>';
	},

	_varFuncKeyValue: function(match){
		let hash = {};
		match.values.forEach(function(value){
			if(value in hash){
				hash[value]++;
			} else {
				hash[value] = 1;
			}
		});
		let output = [];
		for(key in hash){
			output.push({'key':key,'value':hash[key]});
		}
		output = output.sort(function(a,b){
			return b.value - a.value;
		});
		return output;
	},

	_varFuncSortPosition: function(match,position){
		let keyValue = this._varFuncKeyValue(match);
		let key = keyValue[position].key;
		return '<span class="hbvalue">' + key + '</span>';
	},

	_varFuncSortPositionCount: function(match,position){
		let keyValue = this._varFuncKeyValue(match);
		let value = keyValue[position].value;
		return '<span class="hbvalue">' + value + '</span>';
	},

	_varFuncList: function(match){
		let output = '';
		match.uniqueValues.forEach(function(v,i){
			if(i==0){
				output = '<span class="hbvalue">'+v+'</span>';
			} else if(i<match.uniqueValues.length-1) {
				output+= ', <span class="hbvalue">'+v+'</span>';
			} else {
				output+= ' and <span class="hbvalue">'+v+'</span>';
			}
		});
		return output;
	},

	_varFuncListOrCount: function(match){
		if(match.uniqueValues.length>4){
			return this._varFuncCount(match) + ' ' + this._varFuncHeader(match)+'(s)';
		} else {
			return this._varFuncList(match);
		}
	},

	reverse: function(id){

		var self = this;

		//var data = self._data;
		var data = self._fullData;

		//split bite ID into it constituent parts
		var parts = id.split('/');
		//bite ID is first part
		var biteID = parts[0]

		//if bite is a timeseries then reference the full data rather than data filtered to the latest data
		/*if (biteID.substr(0,4)=='time'){
			data = self._fullData;
		}*/

		//if data is filtered for time then set data to subset.  What if timeseries no longer triggers?
		let timeFilter = parts[parts.length-1];
		if(timeFilter == 'timefilter'){
			data = self._data;
			parts.pop();
		}

		//column data in two parts in the unique bite ID.  The original tag and column number
		var columns = [];
		var length = (parts.length-1)/2
		for(i=0;i<length;i++){
			columns.push({'tag':parts[i*2+1],'number':+parts[i*2+2]})
		}
		//for each column confirm if tag is present	
		columns.forEach(function(col,i){
			columns[i]=self.confirmCols(col);
			columns[i].values = self.getValues(data,col);
			columns[i].uniqueValues = self.getDistinct(columns[i].values);
		});
		var bite = this.getBite(biteID);
		var matchingValues = this.createMatchingValues(bite,columns);
		var bites = [];
		newBites = [];
		let uniqueID = '';
		let variables = '';
		if(bite.type!='text'){
			variables = self._getTableVariablesWithMatching(data,bite,matchingValues);
		} else {
			bite.ingredients.forEach(function(ingredient){
				matchingValues[ingredient.name].forEach(function(match){
					uniqueID = bite.id+'/'+match.tag+'/'+match.col;
				})
			});
			let variables = self._getVariables(bite,matchingValues);
			newBites = [{'bite':self._generateTextBite(bite.phrase,variables)[0]}];
			newBites[0].uniqueID = uniqueID;
		}
		if(bite.type=='chart'){
			if (biteID.substr(0,4)=='time'){
				variables = self._formatTimeSeriesVariables(variables);
			}
			newBites = self._generateChartBite(bite.chart,variables);
		}		
		if(bite.type=='table'){
			newBites = self._generateTableBite(bite.table,variables);
		}
		if(bite.type=='crosstable'){
			let variables = self._getCrossTableVariables(data,bite,matchingValues);
			newBites = [self._generateCrossTableBite(bite.table,variables)];
			newBites[0].title = 'Crosstable';
		}
		var mapCheck;						
		if(bite.type=='map'){
			if(bite.subType=='point'){
				variables = self._getTableVariablesForPoint(data,bite,matchingValues);
			}
			//can this whole section be removed
			/*let tag = columns[0].tag;
			let location = null;
			let level = -1;
			if(tag=='#country+code'){
				level = 0;
			}
			if(tag=='#adm1+code'){
				level = 1;
			}
			if(tag=='#adm2+code'){
				level = 2;
			}
			if(tag=='#adm3+code'){
				level = 3;
			}	
			if(level>-1){*/
				//let titleVariables = self._getTitleVariables(bite.variables,matchingValues);				
				//let titles = self._generateTextBite(bite.title,titleVariables);
				//let keyVariable = bite.variables[0]
				//let values = matchingValues[keyVariable][0].values;
				//mapCheck = self._checkMapCodes(level,values);
				/*mapCheck.clean.forEach(function(c){
					mapData.forEach(function(d){
						d[0] = d[0].replace(c[0],c[1]);
					});
				});	*/	
			newBites = self._generateMapBite(bite.chart,variables);
			//}
		}
		newBites.forEach(function(newBite,i){
			
			if(timeFilter == 'timefilter'){
				newBite.uniqueID += '/timefilter';
				newBite.title += ' for '+self.timeSeriesFilter;
			}

			if (biteID.substr(0,4)=='time'){
				let headers = newBite.bite.slice(0, 1);
				data = newBite.bite.slice(1,newBite.bite.length);
				data = data.sort(function(a,b){
					return a[0] - b[0];
				});
				newBite.bite = headers.concat(data);
			}
			bites.push({'type':bite.type,'subtype':bite.subType,'priority':bite.priority,'bite':newBite.bite, 'id':bite.id, 'uniqueID':newBite.uniqueID, 'title':newBite.title});
			if(bite.type=='map'){
				bites[i].geom_url=newBite.geom_url;
				bites[i].geom_attribute=newBite.geom_attribute;
				bites[i].name_attribute=newBite.name_attribute;
			}
		});
		return bites[0];
	},

	getBite: function(id){
		var bite = {};
		hxlBites._chartBites.forEach(function(b){
			if(b.id==id){
				bite = b;
			}
		});
		hxlBites._timeSeriesBites.forEach(function(b){
			if(b.id==id){
				bite = b;
			}
		});
		hxlBites._mapBites.forEach(function(b){
			if(b.id==id){
				bite = b;
			}
		});
		hxlBites._tableBites.forEach(function(b){
			if(b.id==id){
				bite = b;
			}
		});
		hxlBites._crossTableBites.forEach(function(b){
			if(b.id==id){
				bite = b;
			}
		});
		hxlBites._textBites.forEach(function(b){
			if(b.id==id){
				bite = b;
			}
		});										
		return bite;
	},

	confirmCols: function(col){
		var found = false;
		var tag = this._data[1][col.number].split('+')[0];
		var colTag = col.tag.split('+')[0];
		var colAttributes = col.tag.split('+').pop(0);
		if(tag == colTag){
			col.header = this._data[0][col.number];
			found = true;
		}
		/*if(!found){
			//pick up here
			this._data[1].forEach(function(tag){
				tag = 
			});
		}*/
		if(found){
			return col;
		} else {
			return 'Error'
		}
	},

	createMatchingValues: function(bite,cols){
		var self = this;
		var matchingValues = {}
		bite.ingredients.forEach(function(ingredient){
			matchingValues[ingredient.name] = [];
		});
		cols.forEach(function(col){
			//applies the column to the correct ingredient that contains the tag to create matching values
			//might be a problem if both ingredients use the same tag.
			bite.ingredients.forEach(function(ingredient){
				ingredient.tags.forEach(function(tag){
					var formatTag = tag.replace('-','+').split('+')[0];
					var colTag = col.tag.split('+')[0];
					if(self._tagCompare(tag,col.tag)){
						var matchingValue = {};
						matchingValue['tag'] = col.tag;
						matchingValue['header'] = col.header;
						matchingValue['col'] = col.number;
						matchingValue['values'] = col.values;
						matchingValue['uniqueValues'] = col.uniqueValues;
						matchingValues[ingredient.name].push(matchingValue);
					}
				});
			});
		});
		return matchingValues;
	},

	_tagCompare: function(tag1,tag2){
		//doesn't include excludes
		let match = true;
		let tag1include = [];
		let tag2include = [];
		let parts = tag1.split('+').slice(1);
		tag1 = tag1.replace('-','+').split('+')[0];
		parts.forEach(function(p){
			tag1include.push(p.split('-')[0]);
		});
		parts = tag2.split('+').slice(1);
		tag2 = tag2.replace('-','+').split('+')[0];
		parts.forEach(function(p){
			tag2include.push(p.split('-')[0]);
		});
		if(tag1!=tag2){
			match = false;
		}
		tag1include.forEach(function(att1){
			if(tag2include.indexOf(att1)==-1){
				match = false;
			}
		})
		return match;
	},

	getValues: function(data,col){
		var output = [];
		data.forEach(function(row,i){
			if(i>1){
				output.push(row[col.number]);
			}
		});
		return output;
	},

	getDistinct: function(values){
		var output = [];
		values.forEach(function(v,i){
			if(output.indexOf(v)==-1){
				output.push(v);
			}
		});
		return output;
	}	
}

hxlBites._chartBites = [];


//[14,15,16,17,19,20]
// chart bites to do with activities!
// what being #activity, #sector

// chart less than 10 and count rows

hxlBites._chartBites.push({
'id':'chart0001',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'what','tags':['#activity-code-id-url','#sector-code-id']}],
'criteria':['what > 1', 'what < 11'],
'variables': ['what', 'count()'],
'chart':'',
'title':'Count of {1}',
'priority': 8,
});

hxlBites._chartBites.push({
'id':'chart0010',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'what','tags':['#activity-code-id-url','#sector-code-id']}],
'criteria':['what > 10'],
'variables': ['what', 'count()'],
'chart':'rows(10)',
'title':'Top 10 of {1} by count',
'priority': 8,
});

hxlBites._chartBites.push({
'id':'chart0002',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'what','tags':['#activity-code-id-url','#sector-code-id']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value']}],
'criteria':['what > 1', 'what < 11'],
'variables': ['what', 'sum(value)'],
'chart':'',
'title':'{1} by {2}',
'priority': 8,
});

hxlBites._chartBites.push({
'id':'chart0003',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'what','tags':['#activity-code-id-url','#sector-code-id']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value']}],
'criteria':['what > 10'],
'variables': ['what', 'sum(value)'],
'chart':'rows(10)',
'title':'Top 10 of {1} by {2}',
'priority': 8,
});

// chart bites to do with organisations!
// what being #org, #group

// chart less than 10

hxlBites._chartBites.push({
'id':'chart0004',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'who','tags':['#org-id-code','#group-id-code']}],
'criteria':['who > 1', 'who < 11'],
'variables': ['who', 'count()'],
'chart':'',
'title':'Count of {1}',
'priority': 8,
});

//top 10 count

hxlBites._chartBites.push({
'id':'chart0012',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'who','tags':['#org-id-code','#group-id-code']}],
'criteria':['who > 10'],
'variables': ['who', 'count()'],
'chart':'rows(10)',
'title':'Top 10 of {1} by count',
'priority': 8,
});

// less than 10 value

hxlBites._chartBites.push({
'id':'chart0008',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'who','tags':['#org-id-code','#group-id-code']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value']}],
'criteria':['who > 1', 'who < 11'],
'variables': ['who', 'sum(value)'],
'chart':'',
'title':'{2} by {1}',
'priority': 8,
});


// more than 10 value

hxlBites._chartBites.push({
'id':'chart0013',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'who','tags':['#org-id-code','#group-id-code']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value']}],
'criteria':['who > 10'],
'variables': ['who', 'sum(value)'],
'chart':'rows(10)',
'title':'Top 10 of {1} by {2}',
'priority': 8,
});

//chart bites to do with where
//where being #country, #region, #adm, #loc

//where count under 10

hxlBites._chartBites.push({
'id':'chart0005',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'where','tags':['#country-code','#region-code','#adm1-code','#adm2-code','#adm3-code','#adm4-code','#loc-code']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value','#capacity']}],
'criteria':['where > 1', 'where < 11','value ! 0'],
'variables': ['where', 'count()'],
'chart':'',
'title':'Count of {1}',
'priority': 8,
});

hxlBites._chartBites.push({
'id':'chart0006',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'where','tags':['#country-code','#region-code','#adm1-code','#adm2-code','#adm3-code','#adm4-code','#loc-code']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value','#capacity']}],
'criteria':['where > 10','value ! 0'],
'variables': ['where', 'count()'],
'chart':'rows(10)',
'title':'Top 10 of Count of {1}',
'priority': 8,
});

hxlBites._chartBites.push({
'id':'chart0009',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'where','tags':['#country-code','#region-code','#adm1-code','#adm2-code','#adm3-code','#adm4-code','#loc-code']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value','#capacity']}],
'criteria':['where > 1','where < 11'],
'variables': ['where', 'sum(value)'],
'chart':'',
'title':'{2} by {1}',
'priority': 8,
});

hxlBites._chartBites.push({
'id':'chart0018',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'where','tags':['#country-code','#region-code','#adm1-code','#adm2-code','#adm3-code','#adm4-code','#loc-code']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value','#capacity']}],
'criteria':['where > 10'],
'variables': ['where', 'sum(value)'],
'chart':'rows(10)',
'title':'Top 10 of {1} by {2}',
'priority': 8,
});

//charts to do with other text tags
//#indicator, #severity, #status, #event, #modality, #channel, #item, #cause

//value by tag under 10

hxlBites._chartBites.push({
'id':'chart0007',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'indicator','tags':['#indicator-value-pct','#severity','#status','#event-id','#modality','#channel','#crisis','#respondee','#item-unit-code','#cause']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value','#capacity']}],
'criteria':['indicator > 1','indicator < 11'],
'variables': ['indicator', 'sum(value)'],
'chart':'',
'title':'{2} by {1}',
'priority': 8,
});

hxlBites._chartBites.push({
'id':'chart0011',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'indicator','tags':['#indicator-value-pct','#severity','#status','#event-id','#modality','#channel','#crisis','#respondee','#item-unit-code','#cause']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value','#capacity']}],
'criteria':['indicator > 2','indicator < 11','value ! 0'],
'variables': ['indicator', 'count()'],
'chart':'',
'title':'Count of {1}',
'priority': 8,
});

hxlBites._chartBites.push({
'id':'chart0014',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'indicator','tags':['#indicator-value-pct','#severity','#status','#event-id','#modality','#channel','#crisis','#respondee','#item-unit-code','#cause']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value','#capacity']}],
'criteria':['indicator > 10'],
'variables': ['indicator', 'sum(value)'],
'chart':'rows(10)',
'title':'Top 10 of {2} by {1}',
'priority': 8,
});

hxlBites._chartBites.push({
'id':'chart0015',
'type':'chart',
'subType':'row',
'ingredients':[{'name':'indicator','tags':['#indicator-value-pct','#severity','#status','#event-id','#modality','#channel','#crisis','#respondee','#item-unit-code','#cause']},{'name':'value','tags':['#value-pct','#affected','#population','#reached','#targeted','#inneed','#indicator+value','#capacity']}],
'criteria':['indicator > 10','value ! 0'],
'variables': ['indicator', 'count()'],
'chart':'rows(10)',
'title':'Top 10 of count of {1}',
'priority': 8,
});

hxlBites._mapBites = [{
'id':'map0001',
'type':'map',
'subType':'choropleth',
'ingredients':[{'name':'where','tags':['#country+code','#adm1+code','#adm2+code','#adm3+code']}],
'criteria':['where > 1'],
'variables': ['where', 'count()'],
'map':'',
'title':'Count of reports by {1}',
'priority': 10,
},
{
'id':'map0002',
'type':'map',
'subType':'choropleth',
'ingredients':[{'name':'where','tags':['#country+code','#adm1+code','#adm2+code','#adm3+code']},{'name':'value','tags':['#value','#affected','#population','#reached','#targeted','#inneed','#indicator+value','#capacity']}],
'criteria':['where > 1'],
'variables': ['where', 'sum(value)'],
'map':'',
'title':'Map of {2} by {1}',
'priority': 10,
},
{
'id':'map0003',
'type':'map',
'subType':'point',
'ingredients':[{'name':'lat','tags':['#geo+lat']},{'name':'lon','tags':['#geo+lon']}],
'criteria':['lat > 0','lon > 0'],
'variables': ['lat', 'lon'],
'map':'',
'title':'Map of locations',
'priority': 10,
},
{
'id':'map0004',
'type':'map',
'subType':'choropleth',
'ingredients':[{'name':'where','tags':['#country+code','#adm1+code','#adm2+code','#adm3+code']},{'name':'org','tags':['#org-code']}],
'criteria':['where > 1'],
'variables': ['where', 'countDistinct(org)'],
'map':'',
'title':'Distinct Count of {2} by {1}',
'priority': 10,
},
{
'id':'map0005',
'type':'map',
'subType':'choropleth',
'ingredients':[{'name':'where','tags':['#country+code','#adm1+code','#adm2+code','#adm3+code']},{'name':'people','tags':['#contact-email']}],
'criteria':['where > 1'],
'variables': ['where', 'countDistinct(people)'],
'map':'',
'title':'Distinct Count of {2} by {1}',
'priority': 10,
}];

hxlBites._mapValues = {'world':[
		{'name':'world_iso3','level':0,'url':'/static/geoms/world.json','codes':[
				{'name':'ISO3','values':['ABW','AFG','AGO','AIA','ALB','ALD','AND','ARE','ARG','ARM','ASM','ATA','ATC','ATF','ATG','AUS','AUT','AZE','BDI','BEL','BEN','BFA','BGD','BGR','BHR','BHS','BIH','BLM','BLR','BLZ','BMU','BOL','BRA','BRB','BRN','BTN','BWA','CAF','CAN','CHE','CHL','CHN','CIV','CMR','COD','COG','COK','COL','COM','CPV','CRI','CUB','CUW','CYM','CYN','CYP','CZE','DEU','DJI','DMA','DNK','DOM','DZA','ECU','EGY','ERI','ESP','EST','ETH','FIN','FJI','FLK','FRA','FRO','FSM','GAB','GBR','GEO','GGY','GHA','GIN','GMB','GNB','GNQ','GRC','GRD','GRL','GTM','GUM','GUY','HKG','HMD','HND','HRV','HTI','HUN','IDN','IMN','IND','IOA','IOT','IRL','IRN','IRQ','ISL','ISR','ITA','JAM','JEY','JOR','JPN','KAS','KAZ','KEN','KGZ','KHM','KIR','KNA','KOR','KOS','KWT','LAO','LBN','LBR','LBY','LCA','LIE','LKA','LSO','LTU','LUX','LVA','MAC','MAF','MAR','MCO','MDA','MDG','MDV','MEX','MHL','MKD','MLI','MLT','MMR','MNE','MNG','MNP','MOZ','MRT','MSR','MUS','MWI','MYS','NAM','NCL','NER','NFK','NGA','NIC','NIU','NLD','NOR','NPL','NRU','NZL','OMN','PAK','PAN','PCN','PER','PHL','PLW','PNG','POL','PRI','PRK','PRT','PRY','PSX','PYF','QAT','ROU','RUS','RWA','SAH','SAU','SDN','SDS','SEN','SGP','SGS','SHN','SLB','SLE','SLV','SMR','SPM','SRB','STP','SUR','SVK','SVN','SWE','SWZ','SXM','SYC','SYR','TCA','TCD','TGO','THA','TJK','TKM','TLS','TON','TTO','TUN','TUR','TWN','TZA','UGA','UKR','URY','USA','UZB','VAT','VCT','VEN','VGB','VIR','VNM','VUT','WLF','WSM','YEM','ZAF','ZMB','ZWE','SOM']},
				{'name':'ISO2','values':['AE','AF','AG','AL','AM','AO','AR','AT','AU','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BN','BO','BR','BS','BT','BW','BY','BZ','CA','CD','CF','CG','CH','CI','CL','CM','CN','CO','CR','CU','CV','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','ER','ES','ET','FI','FJ','FM','FR','GA','GB','GD','GE','GH','GM','GN','GQ','GR','GT','GW','GY','HN','HR','HT','HU','ID','IE','IL','IN','IQ','IR','IS','IT','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MD','ME','MG','MH','MK','ML','MM','MN','MR','MT','MU','MV','MW','MX','MY','MZ','NA','NE','NG','NI','NL','NO','NP','NR','NZ','OM','PA','PE','PG','PH','PK','PL','PS','PT','PW','PY','QA','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SI','SK','SL','SN','SO','SR','SS','ST','SV','SY','SZ','TD','TG','TH','TJ','TL','TM','TN','TO','TR','TT','TV','TZ','UA','UG','US','UY','UZ','VC','VE','VN','VU','WS','YE','ZA','ZM','ZW']}
			]
		},
	],
	'cod':[
		{'iso3':'AGO', 'iso2':'AO', 'use':'AO', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'BDI', 'iso2':'BI', 'use':'BDI', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'BEN', 'iso2':'BJ', 'use':'BJ', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'BFA', 'iso2':'BF', 'use':'BF', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'BGD', 'iso2':'BD', 'use':'BD', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,2]},
		{'iso3':'BOL', 'iso2':'BO', 'use':'BO', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'BRA', 'iso2':'BR', 'use':'BR', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'CAF', 'iso2':'CF', 'use':'CF', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'CIV', 'iso2':'CI', 'use':'CI', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'CMR', 'iso2':'CM', 'use':'CM', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'COD', 'iso2':'CD', 'use':'CD', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'COG', 'iso2':'CG', 'use':'CG', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'COL', 'iso2':'CO', 'use':'CO', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'COM', 'iso2':'KM', 'use':'KM', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'ECU', 'iso2':'EC', 'use':'EC', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'EGY', 'iso2':'EG', 'use':'EG', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'ETH', 'iso2':'ET', 'use':'ET', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'GBR', 'iso2':'GB', 'use':'GBR', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[2,3]},
		{'iso3':'GEO', 'iso2':'GE', 'use':'GE', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'GIN', 'iso2':'GN', 'use':'GN', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'GTM', 'iso2':'GT', 'use':'GT', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'HTI', 'iso2':'HT', 'use':'HT', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'IDN', 'iso2':'ID', 'use':'IDN', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'IRN', 'iso2':'IR', 'use':'IR', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'IRQ', 'iso2':'IQ', 'use':'IQ', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'KDN', 'iso2':'KD', 'use':'KDN', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'KEN', 'iso2':'KE', 'use':'KE', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'KGZ', 'iso2':'KG', 'use':'KG', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'KHM', 'iso2':'KH', 'use':'KH', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'LAO', 'iso2':'LA', 'use':'LA', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'LBN', 'iso2':'LB', 'use':'LB', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'LBR', 'iso2':'LR', 'use':'LR', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'LBY', 'iso2':'LY', 'use':'LY', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'LKA', 'iso2':'LK', 'use':'LK', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'MLI', 'iso2':'ML', 'use':'ML', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'MMR', 'iso2':'MR', 'use':'MMR', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'MOZ', 'iso2':'MZ', 'use':'MZ', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'MRT', 'iso2':'MT', 'use':'MT', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'MWI', 'iso2':'MW', 'use':'MW', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'NAM', 'iso2':'NA', 'use':'NA', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'NER', 'iso2':'NE', 'use':'NE', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'NGA', 'iso2':'NG', 'use':'NG', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'NPL', 'iso2':'NP', 'use':'NP', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'PAK', 'iso2':'PK', 'use':'PK', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'PNG', 'iso2':'PG', 'use':'PG', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'PRK', 'iso2':'PG', 'use':'PG', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'PSE', 'iso2':'PS', 'use':'PS', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'SDN', 'iso2':'SD', 'use':'SD', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'SEN', 'iso2':'SN', 'use':'SN', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'SLE', 'iso2':'SL', 'use':'SL', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'SOM', 'iso2':'SO', 'use':'SO', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'SSD', 'iso2':'SS', 'use':'SS', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'SYR', 'iso2':'SS', 'use':'SS', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'TCD', 'iso2':'TD', 'use':'TD', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'TGO', 'iso2':'TG', 'use':'TG', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'THA', 'iso2':'TH', 'use':'TH', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2,3]},
		{'iso3':'UKR', 'iso2':'UA', 'use':'UA', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1]},
		{'iso3':'VEN', 'iso2':'VE', 'use':'VE', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'VUT', 'iso2':'VU', 'use':'VU', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'YEM', 'iso2':'YE', 'use':'YE', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'ZBM', 'iso2':'ZM', 'use':'ZM', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'ZWE', 'iso2':'ZW', 'use':'ZW', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'admin{{level}}Pcode','name_att':'admin{{level}}Name','levels':[1,2]},
		{'iso3':'CDH', 'iso2':'CD', 'use':'CDH', 'url':'/static/geoms/topojson/{{country}}/{{level}}/geom.json','adjustment':0,'code_att':'ZSCode','name_att':'Nom','levels':[2]},
	]};

hxlBites._textBites = [
{
'id':'text0001',
'type':'text',
'subType':'intro',
'ingredients':[{'name':'who','tags':['#org-id']},{'name':'what','tags':['#activity-code-id','#sector']},{'name':'where','tags':['#country-code','#region-code','#adm1-code','#adm2-code','#adm3-code','#adm4-code']}],
'criteria':['who < 2','where>1'],
'variables': ['single(who)', 'listOrCount(what)' ,'listOrCount(where)'],
'phrase': '{1} is working in {2}, in {3}.',
'priority': 10,
},
{
'id':'text0002',
'type':'text',
'subType':'intro',
'ingredients':[{'name':'who','tags':['#org-id']},{'name':'what','tags':['#activity-code-id','#sector']},{'name':'where','tags':['#country-code-code','#region-code','#adm1-code','#adm2-code','#adm3-code','#adm4-code']}],
'criteria':['who > 1','where > 1'],
'variables': ['listOrCount(who)', 'listOrCount(what)' ,'listOrCount(where)'],
'phrase': 'There are {1} working in {2}, in {3}.',
'priority': 10,
},
{
'id':'text0003',	
'type':'text',
'subType':'intro',
'ingredients':[{'name':'who','tags':['#org-id']},{'name':'what','tags':['#activity-code-id','#sector']},{'name':'where','tags':['#country-code','#region-code','#adm1-code','#adm2-code','#adm3-code','#adm4-code']}],
'criteria':['who < 2','where<2'],
'variables': ['single(where)', 'single(who)' ,'listOrCount(what)'],
'phrase': 'In {1}, {2} is working in {3}.',
'priority': 10,
},
{
'id':'text0004',
'type':'text',
'subType':'intro',
'ingredients':[{'name':'who','tags':['#org-id']},{'name':'what','tags':['#activity-code-id','#sector']},{'name':'where','tags':['#country-code','#region-code','#adm1-code','#adm2-code','#adm3-code','#adm4-code']}],
'criteria':['who > 1','where<2'],
'variables': ['single(where)', 'listOrCount(who)' ,'listOrCount(what)'],
'phrase': 'In {1}, there are {2} working in {3}.',
'priority': 10,
},
{
'id':'text0005',
'type':'text',
'subType':'main',
'ingredients':[{'name':'what','tags':['#activity-code-id','#sector']}],
'criteria':['what > 1','what < 4'],
'variables': ['header(what)', 'first(what)' ,'firstCount(what)'],
'phrase': 'The largest {1} is {2} with {3} reports.',
'priority': 8,
},
{
'id':'text0006',	
'type':'text',
'subType':'main',
'ingredients':[{'name':'what','tags':['#activity-code-id','#sector']}],
'criteria':['what > 3'],
'variables': ['header(what)', 'first(what)' ,'firstCount(what)', 'second(what)' ,'secondCount(what)'],
'phrase': 'The largest {1} is {2} with {3} reports followed by {4} with {5} reports.',
'priority': 8,
},
{
'id':'text0007',
'type':'text',
'subType':'main',
'ingredients':[{'name':'who','tags':['#org-id']}],
'criteria':['who > 1','who < 4'],
'variables': ['header(who)', 'first(who)' ,'firstCount(who)'],
'phrase': 'The largest {1} is {2} with {3} reports.',
'priority': 8,
},
{
'id':'text0008',	
'type':'text',
'subType':'main',
'ingredients':[{'name':'who','tags':['#org-id']}],
'criteria':['who > 3'],
'variables': ['header(who)', 'first(who)' ,'firstCount(who)', 'second(who)' ,'secondCount(who)'],
'phrase': 'The largest {1} is {2} with {3} reports followed by {4} with {5} reports.',
'priority': 8,
},
{
'id':'text0009',
'type':'text',
'subType':'main',
'ingredients':[{'name':'where','tags':['#country-code','#region-code','#adm1-code','#adm2-code','#adm3-code','#adm4-code']}],
'criteria':['where > 1','where < 4'],
'variables': ['header(where)', 'first(where)' ,'firstCount(where)'],
'phrase': 'The largest {1} is {2} with {3} reports.',
'priority': 8,
},
{
'id':'text0010',	
'type':'text',
'subType':'main',
'ingredients':[{'name':'where','tags':['#country-code','#region-code','#adm1-code','#adm2-code','#adm3-code','#adm4-code']}],
'criteria':['where > 3'],
'variables': ['header(where)', 'first(where)' ,'firstCount(where)', 'second(where)' ,'secondCount(where)'],
'phrase': 'The largest {1} is {2} with {3} reports followed by {4} with {5} reports.',
'priority': 8,
},
{
'id':'text0011',	
'type':'text',
'subType':'main',
'ingredients':[{'name':'crisis','tags':['#crisis+type']}],
'criteria':['crisis > 3'],
'variables': ['header(crisis)', 'first(crisis)' ,'firstCount(crisis)', 'second(crisis)' ,'secondCount(crisis)'],
'phrase': 'The largest {1} is {2} with {3} reports followed by {4} with {5} reports.',
'priority': 8,
},
{
'id':'text0012',	
'type':'text',
'subType':'topline figure',
'ingredients':[{'name':'value','tags':['#affected','#population','#reached','#targeted-type','#inneed','#value','#capacity']}],
'criteria':['value > 0'],
'variables': ['sum(value)','header(value)'],
'phrase': '{2}:{1}',
'priority': 8,
},
{
'id':'text0013',	
'type':'text',
'subType':'topline figure',
'ingredients':[{'name':'countries','tags':['#country-code']}],
'criteria':['countries > 1'],
'variables': ['count(countries)'],
'phrase': 'Countries:{1}',
'priority': 8,
},
{
'id':'text0014',	
'type':'text',
'subType':'topline figure',
'ingredients':[{'name':'respondees','tags':['#respondee']}],
'criteria':['respondees > 0'],
'variables': ['header(respondees)','count(respondees)'],
'phrase': 'Number of {1}:{2}',
'priority': 8,
},
{
'id':'text0015',	
'type':'text',
'subType':'topline figure',
'ingredients':[{'name':'respondees','tags':['#respondee']}],
'criteria':['respondees > 0'],
'variables': ['total()'],
'phrase': 'Total respondee:{1}',
'priority': 8,
},
{
'id':'text0016',	
'type':'text',
'subType':'topline figure',
'ingredients':[{'name':'people','tags':['#contact-email-id-phone']}],
'criteria':['people > 0'],
'variables': ['header(people)','count(people)'],
'phrase': '{1}:{2}',
'priority': 8,
},
{
'id':'text0017',	
'type':'text',
'subType':'topline figure',
'ingredients':[{'name':'indicator','tags':['#indicator+value']}],
'criteria':['indicator > 0'],
'variables': ['header(indicator)','sum(indicator)'],
'phrase': '{1}: {2}',
'priority': 8,
},
{
'id':'text0018',	
'type':'text',
'subType':'topline figure',
'ingredients':[{'name':'org','tags':['#org-id']}],
'criteria':['org > 0'],
'variables': ['header(org)','sum(org)'],
'phrase': '{1}: {2}',
'priority': 8,
}];