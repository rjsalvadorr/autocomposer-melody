var tonal = require('tonal');
var ChordUnit = require('./chord-unit');
var MelodyData = require('./melody-data');

var AcLogic = require('./logic');
const AcConstants = require('./constants');

/**
* Submodule responsible for creating melodies from a given chord progression.
*/
class Melody {
  constructor() {
    /** @type {string} */
    this.lowerLimit = AcConstants.DEFAULT_LOWER_LIMIT;
    /** @type {string} */
    this.upperLimit = AcConstants.DEFAULT_UPPER_LIMIT;
  }

    /**
    * For a given note, find its lowest instance in the specified range.
    * @private
    * @param {string} pitch - pitch class
    * @param {string} lowerLimit - note (written in scientific notation)
    * @param {string} upperLimit - note (written in scientific notation)
    * @return {string[]} - an array of notes (written in scientific pitch)
    */
  _getLowestNoteInRange(pitch, lowerLimit, upperLimit) {
    var chordTonesInRange = tonal.range.pitchSet(pitch, [lowerLimit, upperLimit]);
    return chordTonesInRange[0];
  }

    /**
    * For a given array of chord tones, remove the specified pitches.
    * @private
    * @param {string[]} chordTones - chord tones
    * @param {string[]} pitchArray - pitches to remove
    * @return {string[]} - the remaining chord tones
    */
  _removePitchesFromChordTones(chordTones, pitchArray) {
    var indexToRemove;
    pitchArray.forEach(function(pitch) {
      indexToRemove = chordTones.indexOf(pitch);
      if (indexToRemove > -1) {
        chordTones.splice(indexToRemove, 1);
      }
    });
    return chordTones;
  }

    /**
    * For a given MelodyData, get a simple accompaniment for it.
    * @param {MelodyData} melodyUnit - melody that needs accompaniment
    * @return {string[]} - array of strings, each representing one or more notes to play under each melodic note.
    */
  buildSimpleAccompaniment(melodyUnit) {
    // Omit root note, and maybe avoid doubling the top note as well.
    var noteArray = [], chordNotes, currentChord, bassPitch, topPitch;

    for(var i = 0; i < melodyUnit.chordProgression.length; i++) {
      currentChord = melodyUnit.chordProgression[i];
      bassPitch = tonal.chord.parse(currentChord)["tonic"];
      topPitch =  tonal.note.pc(melodyUnit.melodyNotes[i]);

      chordNotes = tonal.chord.notes(currentChord);
      chordNotes = this._removePitchesFromChordTones(chordNotes, [topPitch]);

      for(var j = 0; j < chordNotes.length; j++) {
        chordNotes[j] = this._getLowestNoteInRange(chordNotes[j], AcConstants.ACCOMPANIMENT_LOWER_LIMIT, AcConstants.ACCOMPANIMENT_UPPER_LIMIT);
      }
      noteArray.push(chordNotes.join(" "));
    }

    return noteArray;
  }

    /**
    * For a given MelodyData, return a basic bass line consisting only of root notes.
    * @private
    * @param {MelodyData} melodyUnit - melody that needs a bassline
    * @return {string[]} - array of strings, each one representing a bass note.
    */
  buildBasicBassLine(melodyUnit) {
    var noteArray = [], currentChord, bassPitch, bassNote;

    // return all the lowest root notes for the progression.
    for(var i = 0; i < melodyUnit.chordProgression.length; i++) {
      currentChord = melodyUnit.chordProgression[i];
      bassPitch = tonal.chord.parse(currentChord)["tonic"];
      bassNote = this._getLowestNoteInRange(bassPitch, AcConstants.BASS_LOWER_LIMIT, AcConstants.BASS_UPPER_LIMIT);

      noteArray.push(bassNote);
    }

    return noteArray;
  }

    /**
    * For a given chord, get all the chord tones between the upper and lower limits.
    * @private
    * @param {string} chord - chord symbol
    * @param {string} lowerLimit - note (written in scientific notation)
    * @param {string} upperLimit - note (written in scientific notation)
    * @return {string[]} - an array of notes (written in scientific pitch)
    */
  _getAllChordTones(chord, lowerLimit, upperLimit) {
    var chordTones = tonal.chord(chord);
    var chordTonesInRange = tonal.range.pitchSet(chordTones, [lowerLimit, upperLimit]);

    for(var i = 0; i < chordTonesInRange.length; i++) {
      for(var j = 0; j < chordTones.length; j++) {
        // Fixing pesky issue where D7 was returned as "D Gb A C" instead of "D F# A C"
        // If the current chord tone is enharmonic with the note from the pitch set,
        // Override it with the chord tone.
        if(tonal.note.pc(chordTonesInRange[i]) != chordTones[j]
          && tonal.note.enharmonics(chordTones[j]).indexOf(tonal.note.pc(chordTonesInRange[i])) > -1) {
          chordTonesInRange[i] = chordTones[j] + tonal.note.oct(chordTonesInRange[i]);
        }
      }
    }

    return chordTonesInRange;
  }

    /**
    * For a given chord symbol, creates a ChordUnit object
    * @private
    * @param {string} chord - chord symbol
    * @param {string} lowerLimit - note (in scientific notation)
    * @param {string} upperLimit - note (in scientific notation)
    * @return {ChordUnit}
    */
  _buildChordUnit(chord, lowerLimit, upperLimit) {
    var chordTonesInRange = this._getAllChordTones(chord, lowerLimit, upperLimit);
    var chordUnit = new ChordUnit.ChordUnit(chord, chordTonesInRange, null);
    return chordUnit;
  }

    /**
    * For a given melody, creates a MelodyData object
    * @private
    * @param {string[]} chordProgression - a chord progression
    * @param {string} melodyString - a melody (in scientific notation)
    * @return {MelodyData}
    */
  _buildMelodyData(chordProgression, melodyString) {
    var arrMelody = melodyString.split(" ");
    var melodyUnit = new MelodyData.MelodyData(chordProgression, arrMelody);
    return melodyUnit;
  }

    /**
    * For a given chord progression and melody, generate a series of melodies that fit over the progression
    * @private
    * @param {string[]} chordProgression - a chord progression
    * @param {string[]} rawMelodies - a string representing the melody
    * @param {Object} options - if true, generated melodies will be sorted, with smoothest melodies coming first.
    * @param {boolean} options.sort - if true, generated melodies will be sorted, with smoothest melodies coming first.
    * @param {number} options.limit - limits the output to a set number.
    * @return {MelodyData[]} - a list of ChordUnit objects.
    */
  _buildMelodyDataList(chordProgression, rawMelodies, options) {
    var melodyUnits = [];
    var haxThis = this;

    rawMelodies.forEach(function(rawMelody) {
      melodyUnits.push(haxThis._buildMelodyData(chordProgression, rawMelody));
    });

    if(options) {
      if(options.sort) {
        melodyUnits.sort(function(a, b) {
          return a.smoothness - b.smoothness;
        });
      }

      if(options.limit) {
        melodyUnits.splice(options.limit);
      }
    }
    return melodyUnits;
  }

    /**
    * For a given chord progression, generate a series of melodies that fit over the progression
    * @private
    * @param {string[]} chordProgression - chord symbols
    * @param {string} lowerLimit - lower limit (in scientific notation). Optional value.
    * @param {string} upperLimit - upper limit (in scientific notation). Optional value.
    * @return {ChordUnit[]} - a list of ChordUnit objects.
    */
  _buildChordUnitList(chordProgression, lowerLimit, upperLimit) {
    if(lowerLimit == null) {
      lowerLimit = this.lowerLimit;
    }
    if(upperLimit == null) {
      upperLimit = this.upperLimit;
    }

    var chordUnitList = [];
    var chordTonesInRange;

    for(var i = chordProgression.length - 1; i >= 0; i--) {
      chordTonesInRange = this._getAllChordTones(chordProgression[i], lowerLimit, upperLimit);

      if(i === chordProgression.length) {
        chordUnitList[i] = new ChordUnit.ChordUnit(chordProgression[i], chordTonesInRange, null);
      } else {
        chordUnitList[i] = new ChordUnit.ChordUnit(chordProgression[i], chordTonesInRange, chordUnitList[i + 1]);
      }
    }

    return chordUnitList;
  }

    /**
    * Recursive function that adds new notes to the previous notes passed into it.
    * On the first call of this function, melodyList should be null.
    * @private
    * @param {ChordUnit} chordUnit - the ChordUnit for the next chord
    * @param {?string[]} melodyList - list of existing melodies
    * @param {Object} options - if true, generated melodies will be filtered
    * @param {boolean} options.filtered - if true, generated melodies will be filtered
    * @return {string[]} - a list of melodies. Each element is a string represeting a melody. Each melody string is written as a series of pitches delimited by a space.
    */
  _buildSimpleMelodiesCore(chordUnit, melodyList, options) {
    var returnList = [];
    var chordTones = chordUnit.chordTones;
    var currentMelody, currentChordTone;
    var rawMelody, newMelody, isInRange;
    var isNotRepetitive, timestamp, haxThis = this;

    if(melodyList) {
      // We're somewhere along the middle of the chain.
      for(var i = 0; i < melodyList.length; i++) {
        currentMelody = melodyList[i];

        for(var j = 0; j < chordTones.length; j++) {
          currentChordTone = chordTones[j];

          if(melodyList.length > 10000) {
            timestamp = new Date().valueOf().toString().slice(-8);
            if(timestamp % 8 === 0) {
              // Randomly skips generation every now and then.
              // Removes 20% of results?
              break;
            }
          }

          newMelody = currentMelody + " " + currentChordTone;

          if(options.filtered) {
            // check the distance of the last note and the new chord tone
            // if it's more than an octave, skip this.
            isInRange = AcLogic.filterMelodyRange(newMelody);
            if(!isInRange) {
              break;
            }

            if(newMelody.split(" ").length >= 3) {
              // check if melody is too repetitive. For our purposes, three of the same notes in a row
              // would be too repetitive.
              isNotRepetitive =  AcLogic.filterRepetition(newMelody);
            } else {
              isNotRepetitive = true;
            }
            if(!isNotRepetitive) {
              break;
            }

            returnList.push(newMelody);
          } else {
            returnList.push(newMelody);
          }
        }
      }
    } else {
      // This is the beginning of the chain.
      melodyList = chordUnit.chordTones;
      returnList.push.apply(returnList, melodyList);
    }

    if(chordUnit.nextChordUnit) {
      // We're somewhere before the end of the chain.
      return this._buildSimpleMelodiesCore(chordUnit.nextChordUnit, returnList, options);
    } else {
      // End of the chain.
      if(options.filtered && returnList.length > AcConstants.NUM_MELODIES_LIMIT) {
        console.log("Generated  " + returnList.length + " melodies. Creating list of " + AcConstants.NUM_MELODIES_LIMIT + "...");
      } else {
        console.log("Generated  " + returnList.length + " melodies.");
      }
      return returnList;
    }
  }

    /**
    * For a given chord progression, generate a series of melodies that fit over the progression.
    * @private
    * @deprecated
    * @param {string[]} chordProgression - chord progression given by user
    * @return {MelodyData[]} - an array of notes (written in scientific pitch)
    */
  buildAllMelodies(chordProgression) {
    var chordUnitList = this._buildChordUnitList(chordProgression, this.lowerLimit, this.upperLimit);
    var melodies = this._buildSimpleMelodiesCore(chordUnitList[0], null, {filtered: false});

    var melodyUnits = [];
    var haxThis = this;
    melodies.forEach(function(rawMelody) {
      melodyUnits.push(haxThis._buildMelodyData(chordProgression, rawMelody));
    });

    return melodyUnits;
  }

    /**
    * For a given chord progression, generate a series of melodies that fit over the progression.
    * @private
    * @deprecated
    * @param {string[]} chordProgression - chord progression given by user
    * @return {string[]} - an array of notes (written in scientific pitch)
    */
  buildRawMelodies(chordProgression) {
    var chordUnitList = this._buildChordUnitList(chordProgression, this.lowerLimit, this.upperLimit);
    var melodies = this._buildSimpleMelodiesCore(chordUnitList[0], null, {filtered: true});

    return melodies;
  }

    /**
    * For a given chord progression, generate a series of melodies that fit over the progression.
    * The melodies are sorted by smoothness, and are limited to the smoothest 100 melodies by default.
    * @param {string[]} chordProgression - chord progression given by user
    * @param {Object} [options] - options for melody generation
    * @param {Object} [options.raw] - if true, returns output as strings (default = false)
    * @param {Object} [options.limit] - if false, returns all the generated melodies, not just the top 100 (default = true)
    * @param {Object} [options.filter] - if false, returns melodies that are considered too "ugly" for the default process. (default = true)
    * @return {MelodyData[]} - an array of MelodyDatas
    */
  buildSimpleMelodies(chordProgression, options) {
    // TODO - change the input to accept both {string} and {string[]}
    var useDefault, melodyUnits, rawMelodies, coreOptions, muOptions;
    var rawOption, limitOption, filterOption, sortOption;
    var chordUnitList = this._buildChordUnitList(chordProgression, this.lowerLimit, this.upperLimit);

    if(options) {
      // In all these ternary operations, the default value is on the right.
      rawOption = options.raw && (options.raw === "true" || options.raw === true) ? true : false;
      filterOption = typeof options.filter !== "undefined" && (options.filter === "false" || options.limit === false) ? false : true;
      if(typeof options.filter !== "undefined" && (options.limit === "false" || options.limit === false)) {
        limitOption = null;
        sortOption = false;
      } else {
        // default vals
        limitOption = AcConstants.NUM_MELODIES_LIMIT;
        sortOption = true;
      }
    } else {
      // default values
      rawOption = false;
      filterOption = true;
      limitOption = AcConstants.NUM_MELODIES_LIMIT;
      sortOption = true;
    }

    rawMelodies = this._buildSimpleMelodiesCore(chordUnitList[0], null, {filtered: filterOption});

    if(rawOption) {
      return rawMelodies;
    }

    melodyUnits = this._buildMelodyDataList(chordProgression, rawMelodies, {sort: sortOption, limit: limitOption});
    return melodyUnits;
  }

};

module.exports = new Melody();
