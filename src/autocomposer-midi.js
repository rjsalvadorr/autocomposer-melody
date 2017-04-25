var MidiWriter = require('midi-writer-js');
var MidiPlayer = require('midi-player-js');
var SoundfontPlayer = require('soundfont-player');
var tonalNote = require('tonal-note');

/**
 * Class responsible for playing audio and generating MIDI files for users.
 */
class AutoComposerMidi {
  constructor() {
    this.INSTRUMENT_NAMES = ["violin", "acoustic_grand_piano", "acoustic_bass"];
    this.NOTE_DURATION = "2";

    this.instruments = {};
    this.player = null;
    this.audioContext = null;
    this.instrumentInit = 0;
    this.instrumentMelody = null;
    this.instrumentAccomp = null;
    this.instrumentBass = null;
    this.audioContext = new AudioContext;
    // Added this flag to fix an issue where notes randomly play again after the track ends.
    // It only works for tracks that are all the same length. If we ever have to play tracks that have
    // different lengths, we'll need a different solution.
    this.playbackLocked = true;

    // is this kind of scope hackery necessary?!
    var haxThis = this;

    for(var i = 0; i < this.INSTRUMENT_NAMES.length; i++) {
      // initialize each instrument
      Soundfont.instrument(this.audioContext, this.INSTRUMENT_NAMES[i], {soundfont: 'FluidR3_GM'}).then(function (sfInstrument) {
        console.log(sfInstrument);
        haxThis.instruments[sfInstrument.name] = sfInstrument;
        haxThis.instrumentInit++;

        if(haxThis.instrumentInit === haxThis.INSTRUMENT_NAMES.length) {
          haxThis._finishLoad();
        }
      });
    }

  }

  _midiCallback(event) {
    // callback for MIDI events
    console.debug(event);

    var instr1 = this.instruments["violin"];
    var instr2 = this.instruments["acoustic_grand_piano"];
    var instr3 = this.instruments["acoustic_bass"];

    if (!this.playbackLocked && event.name == 'Note on' && event.velocity > 0) {
        switch(event.track) {
          case 1:
            instr1.play(event.noteName, this.audioContext.currentTime, {gain: 3});
          case 2:
            instr2.play(event.noteName, this.audioContext.currentTime, {gain: 1});
          case 3:
            instr3.play(event.noteName, this.audioContext.currentTime, {gain: 2});
          default:
            // nothing!
        }
    }

    if (event.name == 'Note off') {
      switch(event.track) {
        case 1:
          instr1.stop();
        case 2:
          instr2.stop();
        case 3:
          instr3.stop();
        default:
          // nothing!
      }
    }

    if (event.name == "End of Track") {
      this.playbackLocked = true;
    }
  }

  _finishLoad() {
    var haxThis = this;
    this.player = new MidiPlayer.Player(function(event) {
      haxThis._midiCallback(event);
    });
    this.playbackLocked = false;
    console.log("[AutoComposerMidi._initializePlayer()] Loading complete!");

    var loadEvent = new Event("midiPlayerReady");
    document.body.dispatchEvent(loadEvent);
  }

    /**
    * Builds MIDI info for a single note
    * @private
    * @param {number} numMidi - MIDI number for a pitch
    * @param {number} duration - MIDI number for a pitch
    * @param {number} wait
    * @return {MidiWriter.NoteEvent} - ???
    */
  _buildNoteMidi(numMidi, duration, wait) {
      if(!wait) {
          wait = "0";
      }
      return new MidiWriter.NoteEvent({pitch: [numMidi], duration: duration, wait: wait, velocity: 100});
  }

    /**
    * Builds MIDI info for a chord
    * @private
    * @param {number[]} arrNumMidi - MIDI numbers for a set of pitches
    * @param {number} duration - MIDI number for a pitch
    * @param {number} wait
    * @return {MidiWriter.NoteEvent} - ???
    */
  _buildChordMidi(arrNumMidi, duration, wait) {
      if(!wait) {
          wait = "0";
      }
      return new MidiWriter.NoteEvent({pitch: arrNumMidi, duration: duration, wait: wait, velocity: 100});
  }
    /**
    * Builds a Track from a given melody.
    * @private
    * @param {string[]} arrMelody - our melody!
    * @return {Track} - a MidiWriter Track
    */
  _buildMelodyTrack(arrMelody) {
    var returnTrack = new MidiWriter.Track();

    for(var i = 0; i < arrMelody.length; i++) {
      var midiNumber = tonalNote.midi(arrMelody[i]);
      returnTrack.addEvent(this._buildNoteMidi(midiNumber, this.NOTE_DURATION));
    }

    return returnTrack;
  }

    /**
    * Gets the MIDI data for a given melody.
    * @private
    * @param {string[]} arrMelody - our melody
    * @return {string} - MIDI data, as a DataURI string
    */
  _buildMelodyMidiSolo(arrMelody) {
    var tracks = [], midiNumber;
    tracks[0] = this._buildMelodyTrack(arrMelody);

    var write = new MidiWriter.Writer(tracks);
    console.log("AutoComposerMidi.[getMidiSolo()] " + write.dataUri());

    return write.dataUri();
  }

    /**
    * Gets the MIDI data for a given melody, with accompaniment.
    * @private
    * @param {string[]} arrMelody - main melody
    * @param {string[]} arrAcompanimentLine - accompaniment line
    * @param {string[]} arrBassLine - bass line
    * @return {string} - MIDI data, as a DataURI string.
    */
  _buildMelodyMidiWithAccompaniment(arrMelody, arrAcompanimentLine, arrBassLine) {
    var tracks, midiNumber;

    var melodyTrack = this._buildMelodyTrack(arrMelody);
    melodyTrack.addInstrumentName("violin");

    var accompanimentTrack = this._buildMelodyTrack(arrAcompanimentLine);
    accompanimentTrack.addInstrumentName("acoustic_grand_piano");

    var bassTrack = this._buildMelodyTrack(arrBassLine);
    bassTrack.addInstrumentName("acoustic_bass");

    tracks = [melodyTrack, accompanimentTrack, bassTrack];

    var write = new MidiWriter.Writer(tracks);
    console.log("AutoComposerMidi.[getMidiSolo()] " + write.dataUri());

    return write.dataUri();
  }

    /**
    * Plays the given melody.
    * @param {string[]} strMidi - MIDI data, as a DataURI string.
    */
  playMelodySolo(melodySolo) {
    var strMidi = this._buildMelodyMidiSolo(melodySolo);
    this._playMelody(strMidi);
  }
    /**
    * Plays the given melodies.
    * @param {string[]} strMidi - MIDI data, as a DataURI string.
    */
  playMelodyWithAccompaniment(melodySolo, melodyAccomp, melodyBass) {
    var strMidi = this._buildMelodyMidiWithAccompaniment(melodySolo, melodyAccomp, melodyBass);
    this._playMelody(strMidi);
  }

    /**
    * Actually plays the given melody
    * @private
    * @param {string} strMidi - MIDI data, as a DataURI string.
    */
  _playMelody(strMidi) {
    this.stopPlayback();
    this.playbackLocked = false;
    this.player.loadDataUri(strMidi);
    this.player.play();
  }

    /**
    * Stops all playback
    */
  stopPlayback() {
    if(this.player.isPlaying()) {
        this.player.stop();
    }
  }
}

exports.AutoComposerMidi = AutoComposerMidi;