/**
 #
 #Copyright (c) 2013-2014 Razortooth Communications, LLC. All rights reserved.
 #
 #Redistribution and use in source and binary forms, with or without modification,
 #are permitted provided that the following conditions are met:
 #
 #    * Redistributions of source code must retain the above copyright notice,
 #      this list of conditions and the following disclaimer.
 #
 #    * Redistributions in binary form must reproduce the above copyright notice,
 #      this list of conditions and the following disclaimer in the documentation
 #      and/or other materials provided with the distribution.
 #
 #    * Neither the name of Razortooth Communications, LLC, nor the names of its
 #      contributors may be used to endorse or promote products derived from this
 #      software without specific prior written permission.
 #
 #THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 #ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 #WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 #DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 #ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 #(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 #LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 #ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 #(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 #SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 **/

var VERSION = '1.0.0prealpha1';

function EpochViewModel() {
    var self = this;
    self.title = ko.observable("");
}



var globalViewModel = {
    epochView: new EpochViewModel(),
};

function genericUploader() {
    var uploader = new qq.FineUploader({
        element : $('#fine-uploader')[0],
        callbacks : {
            onComplete : function(id, name, response) {
                $('#fine-uploader').fadeIn();
                $('div.qq-upload-button').hide();
                $('li.qq-upload-success').fadeOut(5000, "linear");
                if (response.success) {
                    doShowIQSetUploadSummaryModal(response);
                }
            }
        },
        mode: 'custom',
        validation : {
            allowedExtensions : [ 'csv', 'pdf', 'xls', 'doc', 'docx', 'gif', 'jpg', 'png', 'txt', 'html' ],
        },
        request : {
            endpoint : '/smile/iqset'
        }
    });
}

function loadSession(cb, params) {
    //
    // Ignore params
    //
    if (params) {
        // Do something
    }

    $.ajax({ cache: false, type: "GET", dataType: "json", url: '/smile/iqsets', data: {}, error: function(xhr, text, err) {
        // TODO: XXX Decide what to do if this post fails
        // smileAlert('#globalstatus', 'Unable to get inquiry.  Reason: ' + xhr.status + ':' + xhr.responseText + '.  Please verify your connection or server status.', 'trace');
        alert("Problem getting iqsets");
    }, success: function(data) {
        if (data) {

            if (cb) {
                cb();
            }
        }
    }
    });
}

function pushSection(toID, fromID) {
    console.log("toID = " + toID);
    if (!fromID) {
        console.log("fromID is null");
        // Use toID and hide the active section
       var $from = $(toID).parent().find('section.active');
       if ($from) {
            fromID = $from.attr('id');
       }
    }
    console.log("found fromID = " + fromID);
    if (!toID) {
        console.log('toID is null');
        return;
    }
    $('#' + fromID).removeClass("active").fadeOut();
    $(toID).addClass("active").fadeIn();
}

var handleDialog1 = function(evtdata) {
    $('#dialog1-yes').click(function() { 

        // update the block message 
        $.blockUI({ message: "<h4 class='subheader'>Deleting IQSet: " + evtdata.attr('id') + "</h4>" }); 
 
        $.ajax({ cache: false, type: "DELETE", dataType: "json", url: '/smile/iqset/' + evtdata.attr('id'), data: {}, error: function(xhr, text, err) {
        // TODO: XXX Decide what to do if this post fails
        // smileAlert('#globalstatus', 'Unable to get inquiry.  Reason: ' + xhr.status + ':' + xhr.responseText + '.  Please verify your connection or server status.', 'trace');
            alert("Problem deleting iqset");
        }, success: function(data) {
            if (data) {
                /*
                var iqsets = data;
                var total_rows = data.total_rows;
                var rows = data.rows;

                ko.utils.arrayPushAll(globalViewModel.iqsetCollection.iqsets, rows);
                */
                if (data.error) {
                    // Let's write an error
                    $.blockUI({ message: 'Error on dialog action, reason: ' + data.error }); 
                } else {
                    alert('Do something: Implement this');
                }
            } else {
                $.blockUI({ message: 'Error, no data returned, probably did not work'}); 
            }
            setTimeout(function() {
                    $.unblockUI(); 
            }, 4000);
        }
        });
    }); 
 
    $('#dialog1-no').click(function() { 
            $.unblockUI(); 
            return false; 
    });
};

$(document).ready(function() {
    //
    // Init globals
    //
    ko.applyBindings(globalViewModel);

    //
    // Init handlers
    //
    // XXX Implement this  createGenericUploader(); // fineuploader for Files

    $('#iqsetupload_btn').click(function() { 
        $('#fine-uploader input:file').trigger('click');
    });

    //
    // Init UI
    //
    $('#app-version').append(VERSION);


    // XXX We need to enable some buttons
    /*
    $('#epoch-student-section').on('click', '.iqset-delete-btn', function() {
        $.blockUI({ message: $('#dialog1'),
                    css: { width: '275px' },
                    onBlock: handleDialog1($(this))
        }); 
    });
 
    $('#epoch-sessions-section').on('click', '.session-view-btn', function() {
        loadSession($(this), pushSection('#session-detail-section'));
    });
    */
    

});