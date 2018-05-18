/*
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';

var leftVideo = document.getElementById('leftVideo');
var leftVideo2 = document.getElementById('leftVideo2');
var rightVideo = document.getElementById('rightVideo');
var currentTimeInput = document.getElementById('currentTime');

var stream;
var stream2;
var remoteStreams = [];

var pc1;
var pc2;
var pc3;
var pc4;
var offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

var pc1SendChannel;
var pc2SendChannel;
var pc3SendChannel;
var pc4SendChannel;

var startTime;
var selectedStream = null;

function maybeCreateStream() {
  if (stream) {
    return;
  }

  if (leftVideo.captureStream) {
    stream = leftVideo.captureStream();
    stream2 = leftVideo2.captureStream();
    console.log('Captured stream from leftVideo with captureStream',
      stream);
    console.log('Captured stream from leftVideo2 with captureStream',
      stream2);
    call();
  } else if (leftVideo.mozCaptureStream) {
    stream = leftVideo.mozCaptureStream();
    console.log('Captured stream from leftVideo with mozCaptureStream()',
      stream);
    call();
  } else {
    trace('captureStream() not supported');
  }
}

// Video tag capture must be set up after video tracks are enumerated.
leftVideo.oncanplay = maybeCreateStream;
if (leftVideo.readyState >= 3) {  // HAVE_FUTURE_DATA
  // Video is already ready to play, call maybeCreateStream in case oncanplay
  // fired before we registered the event handler.
  maybeCreateStream();
}

// leftVideo.play();

rightVideo.onloadedmetadata = function() {
  trace('Remote video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
};

rightVideo.onresize = function() {
  trace('Remote video size changed to ' +
    rightVideo.videoWidth + 'x' + rightVideo.videoHeight);
  // We'll use the first onresize callback as an indication that
  // video has started playing out.
  if (startTime) {
    var elapsedTime = window.performance.now() - startTime;
    trace('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
};

function call() {
  trace('Starting call');
  startTime = window.performance.now();
  var videoTracks = stream.getVideoTracks();
  var audioTracks = stream.getAudioTracks();
  if (videoTracks.length > 0) {
    trace('Using video device: ' + videoTracks[0].label);
  }
  if (audioTracks.length > 0) {
    trace('Using audio device: ' + audioTracks[0].label);
  }
  var servers = null;

  pc1 = new RTCPeerConnection(servers);
  trace('Created local peer connection object pc1');

  var dataConstraint = null;
  pc1SendChannel = pc1.createDataChannel('sendDataChannel',
    dataConstraint);
  trace('Created send data channel for pc1');

  pc1.onicecandidate = function(e) {
    onIceCandidate(pc1, e);
  };
  pc1.ondatachannel = receiveChannelCallback("pc1");


  pc2 = new RTCPeerConnection(servers);
  trace('Created remote peer connection object pc2');
  pc2.onicecandidate = function(e) {
    onIceCandidate(pc2, e);
  };
  pc1.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc1, e);
  };
  pc2.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc2, e);
  };
  pc2SendChannel = pc2.createDataChannel('sendDataChannel',
    dataConstraint);
  pc2.ontrack = gotRemoteStream;
  pc2.ondatachannel = receiveChannelCallback("pc2");

  stream.getTracks().forEach(
    function(track) {
      pc1.addTrack(
        track,
        stream
      );
    }
  );
  trace('Added local stream to pc1');

  trace('pc1 createOffer start');
  pc1.createOffer(onCreateOfferSuccess, onCreateSessionDescriptionError,
    offerOptions);


  // second stream

  pc3 = new RTCPeerConnection(servers);
  trace('Created local peer connection object pc3');

  var dataConstraint = null;
  pc3SendChannel = pc3.createDataChannel('sendDataChannel2',
    dataConstraint);
  trace('Created send data channel for pc3');

  pc3.onicecandidate = function(e) {
    onIceCandidate(pc3, e);
  };
  pc3.ondatachannel = receiveChannelCallback("pc3");

  pc4 = new RTCPeerConnection(servers);
  trace('Created remote peer connection object pc4');
  pc4.onicecandidate = function(e) {
    onIceCandidate(pc4, e);
  };
  pc3.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc3, e);
  };
  pc4.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc4, e);
  };
  pc4SendChannel = pc4.createDataChannel('sendDataChannel2',
    dataConstraint);
  pc4.ontrack = gotRemoteStream;
  pc4.ondatachannel = receiveChannelCallback("pc4");

  stream2.getTracks().forEach(
    function(track) {
      pc3.addTrack(
        track,
        stream2
      );
    }
  );
  trace('Added local stream to pc3');

  trace('pc3 createOffer start');
  pc3.createOffer(onCreateOfferSuccess2, onCreateSessionDescriptionError,
    offerOptions);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function onCreateOfferSuccess(desc) {
  trace('Offer from pc1\n' + desc.sdp);
  trace('pc1 setLocalDescription start');
  pc1.setLocalDescription(desc, function() {
    onSetLocalSuccess(pc1);
  }, onSetSessionDescriptionError);
  trace('pc2 setRemoteDescription start');
  pc2.setRemoteDescription(desc, function() {
    onSetRemoteSuccess(pc2);
  }, onSetSessionDescriptionError);
  trace('pc2 createAnswer start');
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  pc2.createAnswer(onCreateAnswerSuccess, onCreateSessionDescriptionError);
}

function onCreateOfferSuccess2(desc) {
  trace('Offer from pc3\n' + desc.sdp);
  trace('pc3 setLocalDescription start');
  pc3.setLocalDescription(desc, function() {
    onSetLocalSuccess(pc3);
  }, onSetSessionDescriptionError);
  trace('pc4 setRemoteDescription start');
  pc4.setRemoteDescription(desc, function() {
    onSetRemoteSuccess(pc4);
  }, onSetSessionDescriptionError);
  trace('pc4 createAnswer start');
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  pc4.createAnswer(onCreateAnswerSuccess2, onCreateSessionDescriptionError);
}


function onSetLocalSuccess(pc) {
  trace(getName(pc) + ' setLocalDescription complete');
}

function onSetRemoteSuccess(pc) {
  trace(getName(pc) + ' setRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
  trace('Failed to set session description: ' + error.toString());
}

function gotRemoteStream(event) {
  remoteStreams.push(event.streams[0]);
}

function onCreateAnswerSuccess(desc) {
  trace('Answer from pc2:\n' + desc.sdp);
  trace('pc2 setLocalDescription start');
  pc2.setLocalDescription(desc, function() {
    onSetLocalSuccess(pc2);
  }, onSetSessionDescriptionError);
  trace('pc1 setRemoteDescription start');
  pc1.setRemoteDescription(desc, function() {
    onSetRemoteSuccess(pc1);
  }, onSetSessionDescriptionError);
}

function onCreateAnswerSuccess2(desc) {
  trace('Answer from pc4:\n' + desc.sdp);
  trace('pc4 setLocalDescription start');
  pc4.setLocalDescription(desc, function() {
    onSetLocalSuccess(pc4);
  }, onSetSessionDescriptionError);
  trace('pc3 setRemoteDescription start');
  pc3.setRemoteDescription(desc, function() {
    onSetRemoteSuccess(pc3);
  }, onSetSessionDescriptionError);
}

function onIceCandidate(pc, event) {
  getOtherPc(pc).addIceCandidate(event.candidate)
  .then(
    function() {
      onAddIceCandidateSuccess(pc);
    },
    function(err) {
      onAddIceCandidateError(pc, err);
    }
  );
  trace(getName(pc) + ' ICE candidate: \n' + (event.candidate ?
      event.candidate.candidate : '(null)'));
}

function onAddIceCandidateSuccess(pc) {
  trace(getName(pc) + ' addIceCandidate success');
}

function onAddIceCandidateError(pc, error) {
  trace(getName(pc) + ' failed to add ICE Candidate: ' + error.toString());
}

function onIceStateChange(pc, event) {
  if (pc) {
    trace(getName(pc) + ' ICE state: ' + pc.iceConnectionState);
    console.log('ICE state change event: ', event);
  }
}

function getName(pc) {
  return (pc === pc1) ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
  if(pc === pc1 || pc === pc2) {
    return (pc === pc1) ? pc2 : pc1;
  }
  
  return (pc === pc3) ? pc4 : pc3;
}

function receiveChannelCallback(channelName) {
  return function(event) {
    trace('Receive Channel Callback');
    var receiveChannel = event.channel;

    receiveChannel.onmessage = function(event) {
      var cmd = event.data.split(",");

      // media player controls
      if(channelName == "pc1") {
        if(cmd[0] == "seek") {
          var seconds = parseFloat(cmd[1]);
          leftVideo.currentTime = seconds;
        }
        else if(cmd[0] == "play") {
          leftVideo.play();          
        }
        else if(cmd[0] == "pause") {
          leftVideo.pause();
        }
        else {
          trace("unknown command:" + event.data);
        }
      }
      else if(channelName == "pc2") {
        if(cmd[0] == "time") {
          if(selectedStream === 0) {
            currentTimeInput.value = cmd[1];
          }
        }
      }
      if(channelName == "pc3") {
        if(cmd[0] == "seek") {
          var seconds = parseFloat(cmd[1]);
          leftVideo2.currentTime = seconds;
        }
        else if(cmd[0] == "play") {
          leftVideo2.play();          
        }
        else if(cmd[0] == "pause") {
          leftVideo2.pause();
        }
        else {
          trace("unknown command:" + event.data);
        }
      }
      else if(channelName == "pc4") {
        if(cmd[0] == "time") {
          if(selectedStream === 2) {
            currentTimeInput.value = cmd[1];
          }
        }
      }
    };
    receiveChannel.onopen = function() {
      trace("channel open: " + channelName)

      if(channelName == "pc2" && !pc2SendChannel) {
        pc2SendChannel = receiveChannel;
      }
    };
    receiveChannel.onclose = function() {
      trace("channel closed: " + channelName)
    };
  }
}

function seek(seconds) {
  if(selectedStream === 0) {
    pc2SendChannel.send("seek," + seconds)
  }
  else {
    pc4SendChannel.send("seek," + seconds)
  }
}

function play() {
  if(selectedStream === 0) {
    pc2SendChannel.send("play,");
  }
  else {
    pc4SendChannel.send("play,");
  }
}

function pause() {
  if(selectedStream === 0) {
    pc2SendChannel.send("pause,");
  }
  else {
    pc4SendChannel.send("pause,");
  }
}

setInterval(function() {
  if(pc1SendChannel) {
    pc1SendChannel.send("time," + leftVideo.currentTime)
  }
  
  if(pc3SendChannel) {
    pc3SendChannel.send("time," + leftVideo2.currentTime)
  }
}, 500)

function setStream(idx) {
  rightVideo.srcObject = remoteStreams[idx];
  selectedStream = idx;
}
