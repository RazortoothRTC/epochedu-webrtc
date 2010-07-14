#!/usr/bin/perl

use strict;
use warnings;
use Tatsumaki;
use Tatsumaki::Error;
use Tatsumaki::Application;
use Time::HiRes;

package ChatPollHandler;
use base qw(Tatsumaki::Handler);
__PACKAGE__->asynchronous(1);

use Tatsumaki::MessageQueue;

sub get {
    my($self, $channel) = @_;
    my $mq = Tatsumaki::MessageQueue->instance($channel);
    my $client_id = $self->request->param('client_id')
        or Tatsumaki::Error::HTTP->throw(500, "'client_id' needed");
    $client_id = rand(1) if $client_id eq 'dummy'; # for benchmarking stuff
    $mq->poll_once($client_id, sub { $self->on_new_event(@_) });
}

sub on_new_event {
    my($self, @events) = @_;
    $self->write(\@events);
    $self->finish;
}

package ChatMultipartPollHandler;
use base qw(Tatsumaki::Handler);
__PACKAGE__->asynchronous(1);

sub get {
    my($self, $channel) = @_;

    my $client_id = $self->request->param('client_id') || rand(1);

    $self->multipart_xhr_push(1);

    my $mq = Tatsumaki::MessageQueue->instance($channel);
    $mq->poll($client_id, sub {
        my @events = @_;
        for my $event (@events) {
            $self->stream_write($event);
        }
    });
}

package ChatPostHandler;
use base qw(Tatsumaki::Handler);
use HTML::Entities;
use Encode;

sub post {
    my($self, $channel) = @_;

    my $v = $self->request->params;
    my $html = $self->format_message($v->{text});
    my $mq = Tatsumaki::MessageQueue->instance($channel);
    $mq->publish({
        type => "message", html => $html, ident => $v->{ident},
        avatar => $v->{avatar}, name => $v->{name},
        address => $self->request->address,
        time => scalar Time::HiRes::gettimeofday,
    });
    $self->write({ success => 1 });
}

sub format_message {
    my($self, $text) = @_;
    $text =~ s{ (https?://\S+) | ([&<>"']+) }
              { $1 ? do { my $url = HTML::Entities::encode($1); qq(<a target="_blank" href="$url">$url</a>) } :
                $2 ? HTML::Entities::encode($2) : '' }egx;
    $text;
}

package ChatRoomHandler;
use base qw(Tatsumaki::Handler);

sub get {
    my($self, $channel) = @_;
    $self->render('epoch-teacher.html');
}

package ContentRepoDBHandler;
use base qw(Tatsumaki::Handler);
use JSON;
use Plack::App::Directory;
use Plack::Request;
use Plack::Util;
use URI::Escape;
# use Plack::App::File;

#
# JSON Format
#
# {"ContentSet":
#	"totalResultsAvailable":"<INT>",
#	"totalResultsReturned":"<INT>",
# 	"Content":[
#	{"Title":"<STRING>",
# 	 "Url":"<STRING>",
# 	 "Tags":"<CSV>",
#	 "MimeType":"<STRING>",
#	 "SourceURI":"<STRING">,
#	 "License":"<STRING>",
#	}
#	]
# "}
#
sub get {
	my $self = shift;
	my $pathinfo = $self->request->path_info;
	my $serverhost = $self->request->headers->header('Host');
	my $output = $self->request->param("output");
	my @contentlist = ();
	my $contentliststr = '';
	
	if ($output eq 'json') {
		$self->response->content_type('application/json');
	} else {
		$self->response->content_type('text/plain');
	}
	opendir(DIR, "./contentrepo");

	while (my $file = readdir(DIR)) {
		# Use a regular expression to ignore files beginning with a period
		next if ($file =~ m/^\./);
		push(@contentlist, 'http://' . $serverhost . "/" . uri_escape("$file"));
		# $self->write($pathinfo . "/" . uri_escape("$file") . "\n");
	}
	closedir(DIR);
	
	foreach my $index (1 .. $#contentlist) {
		my $sep = ',';
		if ($index eq @contentlist - 1) {
			$sep = '';
		}
		$contentliststr = $contentliststr . $contentlist[$index] . $sep;
	}
	my $contentresults = {
		totalResults => @contentlist . "",
		contents => $contentliststr,
	};
	
	my $json_out = to_json($contentresults);
	
	
	$self->write($json_out . "\n");
	$self->finish;
	#if ($path_info eq '/foo.json') {
	#	my $body = JSON::encode_json({
	#		hello => 'world',
	#	});
	#	return [ 200, ['Content-Type', 'application/json'], [ $body ] ];
	#}
	# return [ 404, ['Content-Type', 'text/html'], ['Not Found']];

	
	# my $app = Plack::App::Directory->new({root => "$ENV{HOME}/Sites"})->to_app;
	# my $self = shift;
	# $self->(Plack::App::Directory->new(root => "$ENV{HOME}/Sites"));
	# my $self = shift;
	# $self->response->content_type('text/plain');
	# Plack::App::Directory->new(root => "$ENV{HOME}/Sites");
    # $self->render(Plack::App::Directory->new(root => "$ENV{HOME}/Sites"));
	# Plack::App::File->new(root => "$ENV{HOME}/Sites");
}

package main;
use File::Basename;

my $chat_re = '[\w\.\-]+';
my $app = Tatsumaki::Application->new([
    "/chat/($chat_re)/poll" => 'ChatPollHandler',
    "/chat/($chat_re)/mxhrpoll" => 'ChatMultipartPollHandler',
    "/chat/($chat_re)/post" => 'ChatPostHandler',
    "/chat/($chat_re)" => 'ChatRoomHandler',
	"/crdb" => 'ContentRepoDBHandler',
]);

$app->template_path(dirname(__FILE__) . "/templates");
$app->static_path(dirname(__FILE__) . "/static");

if (__FILE__ eq $0) {
    require Tatsumaki::Server;
    Tatsumaki::Server->new(port => 5000)->run($app);
} else {
    return $app;
}

