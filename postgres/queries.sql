-- Partnership query
select players, played, won, lost, round(won/played * 100, 2) as "winning %" from
(select *, sum(won+lost) as played from (
select "pair" players, count(result) as won  from (
	select pg."result", pg."gameID", string_agg(pl.username, ' - ' order by pl.username asc) as pair from (
		select * from players_games as pg2 where pg2."gameID" in (select pg."gameID" from players_games as pg left join players pl using("playerID") where "result"='won') and result = 'won'
	) as pg left join players pl using("playerID") where "result"='won' group by "gameID", "result"
) as tab group by pair) as t1
left join 
(select "pair" players, count(result) as lost  from (
	select pg."result", pg."gameID", string_agg(pl.username, ' - ' order by pl.username asc) as pair from (
		select * from players_games as pg2 where pg2."gameID" in (select pg."gameID" from players_games as pg left join players pl using("playerID") where "result"='lost') and result = 'lost'
	) as pg left join players pl using("playerID") where "result"='lost' group by "gameID", "result"
) as tab group by pair) as t2 using (players) group by t1.players, t1.won, t2.lost) as t3 order by "winning %" desc;

-- Player Ranking
select *, round(won/played * 100, 2) as "winning %", ceil((won/played * score)+tricks) as rating from
(select t1.username, sum(t1.lost + t2.won) as played, t2.won, t1.lost, t2.score, tricks from
(select p.username, count(pg."result") as "lost" from players_games as pg left join players p using ("playerID") where "result"='lost' group by "result", p.username) as t1
left join
(select p.username, count(pg."result") as "won", sum(pg.score) as score, sum(tricks) as tricks from players_games as pg left join players p using ("playerID") where "result"='won' group by "result", p.username) as t2 
using (username) group by t1.username, t1.lost, t2.won, t2.score, t2.tricks) as t3 order by "rating" desc;

-- bets count
select p.username, bet, count(b.bet) from bets b left join players p using ("playerID") group by username, bet order by bet asc, count desc;

-- trump called
select *, ("Trump Called"*1.0/played*100) as "%age" from 
(select p.username, count(pg."gameID") as played from players p inner join players_games pg using ("playerID") group by p.username) as t1
inner join 
(select p.username, count(pg."playerNum") as "Trump Called" from players_games as pg left join players p using ("playerID") where "playerNum" = 1 group by p.username order by "Trump Called" desc) as t2
using (username) order by "%age" desc;

-- passed query
select username, played, count as passed, (count*1.0/played*100) as "%age" from 
(select p.username, count(pg."gameID") as played from players p inner join players_games pg using ("playerID") group by p.username) as t1
inner join 
(select p.username, bet, count(b.bet) from bets b left join players p using ("playerID") where bet = 0 group by username, bet order by bet asc, count desc) as t2
using (username) order by "%age" desc;