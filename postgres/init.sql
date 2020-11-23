CREATE TYPE gametype AS ENUM ('mooda', 'bidding');
CREATE TYPE gamestatus AS ENUM ('in-progress', 'ended');
CREATE TYPE gameresult AS ENUM ('won', 'lost');
CREATE TYPE playertype AS ENUM ('reg', 'guest');

CREATE TABLE public.players (
	"playerID" serial NOT NULL,
	"firstName" varchar NOT NULL,
	"lastName" varchar NOT NULL,
	"email" varchar NOT null unique,
	"phone" varchar NULL,
	"username" varchar NOT null unique,
	"password" varchar NOT NULL,
	"created" timestamp NOT NULL default NOW(),
	"playerType" playertype NOT NULL default 'guest'
);

CREATE TABLE public.games (
	"gameID" uuid NOT null unique,
	"roomID" uuid NOT null,
	"gameType" gametype NOT NULL,
	"status" gamestatus NULL,  
	"start_dt" timestamp NOT null,
	"end_dt" timestamp NOT null,
	"trumpCard" varchar not null,
	"moodaSuit" varchar not null
);

CREATE TABLE public.bets (
	"betID" serial not null,
	"gameID" uuid NOT null,
	"playerID" int NOT null,
	"bet" int NOT null
);

CREATE TABLE public.players_games (
	"playerID" int NOT NULL,
	"gameID" uuid not null,
	"playerNum" int not null,
	"result" gameresult not null,
	"score" int not null default 0,
	"tricks" int not null default 0
);

CREATE INDEX players_username_idx ON public.players (username);
