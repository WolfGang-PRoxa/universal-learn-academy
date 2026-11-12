DROP TABLE IF EXISTS interp;
DROP TABLE IF EXISTS leader;
DROP TABLE IF EXISTS compo;
DROP TABLE IF EXISTS enreg;
DROP TABLE IF EXISTS cd;
DROP TABLE IF EXISTS edition;
DROP TABLE IF EXISTS personne;

-- create tables
CREATE TABLE personne (
 id_pers serial primary key,
 nom_pers character varying(20) NOT NULL,
 prenom_pers character varying(20),
 date_nais date,
 date_deces date,
 pays_nationalite character varying(30)
);

CREATE TABLE edition (
 id_edit  serial primary key,
 nom_edit  character varying(20) NOT NULL,
 pays   character varying(30)
);

CREATE TABLE cd (
 id_cd serial primary key,
 titre_cd character varying(60),
 id_edit integer REFERENCES edition,
 note_art numeric(2),
 note_tech  numeric(2), 
 nom_distrib varchar(50)
);

CREATE TABLE enreg(
 id_cd integer references cd,
 id_enr  integer,
 titre_enr character varying(30),
 duree_enr numeric(6,0),
 annee_enr numeric(6,0),
 lieu_enr character varying(30),
 cond_enr  character varying(60),
 CONSTRAINT enreg_key PRIMARY KEY(id_cd,id_enr)
);
 
CREATE TABLE interp (
 id_cd integer references cd,
 id_enr  integer,
 id_interprete integer REFERENCES personne,
 instrument  character varying(30) not null,
 CONSTRAINT interp_key PRIMARY KEY(id_cd, id_enr, id_interprete, instrument),
 CONSTRAINT id_enr_exists FOREIGN KEY(id_cd,id_enr) REFERENCES enreg
);
 
CREATE TABLE leader (
 id_cd integer references cd,
 id_leader integer REFERENCES personne,
 CONSTRAINT leader_key PRIMARY KEY(id_cd, id_leader)
);

 
-- Table Compositeur —
-- INSEREZ VOTRE CODE POUR TABLE COMPO !!! ICI !!!







-- fill in data

-- personne
INSERT INTO personne VALUES (1,'mikta','boris','10-APR-1961','30-AUG-1999','usa');
INSERT INTO personne VALUES (2,'jorris','achille','10-JAN-1955',NULL,'france');
INSERT INTO personne VALUES (3,'coltrane','john','21-OCT-1957','08-MAY-2006','usa');
INSERT INTO personne VALUES (4,'monk','thelonious','25-DEC-1968','29-MAR-2009','usa');
INSERT INTO personne VALUES (5,'white','bary','21-FEB-1962',NULL,'usa');
INSERT INTO personne VALUES (6,'mingus','charly','10-JAN-1963',NULL,'usa');
INSERT INTO personne VALUES (7,'smith','ted','28-AUG-1948',NULL,'usa');
INSERT INTO personne VALUES (8,'spark','tom','26-MAR-1963',NULL,'usa');
INSERT INTO personne VALUES (9,'rozzi','ricky','10-JAN-1958',NULL,'usa');
INSERT INTO personne VALUES (10,'dupond','william','01-MAY-1956',NULL,'usa');

-- edition
INSERT INTO edition VALUES (1,'virgin','usa');
INSERT INTO edition VALUES (2,'blues_label','usa');
INSERT INTO edition VALUES (3,'monk','france');
INSERT INTO edition VALUES (4,'tictac','france');

-- cd
INSERT INTO cd VALUES (1,'blues chicago',1,8,7,null);
INSERT INTO cd VALUES (2,'evidence',1,9,6,null);
INSERT INTO cd VALUES (3,'ballad in paris',2,8,9,null);
INSERT INTO cd VALUES (4,'mississipi notes',4,6,7,null);

INSERT INTO cd VALUES (5, 'at last', 2, 3, 3);

-- enreg
INSERT INTO enreg VALUES (1,1,'evidence',200,1983,'chicago','public');
INSERT INTO enreg VALUES (1,2,'on the moon',256,1984,'chicago','public');
INSERT INTO enreg VALUES (1,3,'blue river',159,1984,'chicago','public');
INSERT INTO enreg VALUES (2,1,'blues is my god',540,1972,'new-york','studio');
INSERT INTO enreg VALUES (2,2,'blues campagn',189,1972,'new-york','studio');
INSERT INTO enreg VALUES (2,3,'pain',280,1972,'new-york','acoustic');
INSERT INTO enreg VALUES (3,1,'crying sky',156,1995,'paris','public');
INSERT INTO enreg VALUES (3,2,'love and peace',205,1995,'paris','public');
INSERT INTO enreg VALUES (3,3,'jump',164,1995,'paris','public');
INSERT INTO enreg VALUES (3,4,'peace',180,1995,'philadelphie','public');
INSERT INTO enreg VALUES (4,1,'slave and glave',199,1978,'saint-louis','public');
INSERT INTO enreg VALUES (4,2,'move the gov',245,1978,'saint-louis','acoustic');
INSERT INTO enreg VALUES (4,3,'rainbow',180,1978,'saint-louis','public');
INSERT INTO enreg VALUES (4,4,'mississipi',200,1978,'londres','studio');

INSERT INTO enreg VALUES (5, 1,  'at last', 259, 1961, 'chicago','studio');
INSERT INTO enreg VALUES (5, 2,  'my old flame', 620, 1961, 'chicago', 'studio');
INSERT INTO enreg VALUES (5, 3, 'summertime', 527, 1969, 'new-york','public');

-- compo
INSERT INTO compo VALUES (1,1,1);
INSERT INTO compo VALUES (1,2,2);
INSERT INTO compo VALUES (1,3,1);
INSERT INTO compo VALUES (1,3,2);
INSERT INTO compo VALUES (1,3,5);
INSERT INTO compo VALUES (2,1,6);
INSERT INTO compo VALUES (2,2,6);
INSERT INTO compo VALUES (2,3,3);
INSERT INTO compo VALUES (2,3,1);
INSERT INTO compo VALUES (3,1,4);
INSERT INTO compo VALUES (3,2,4);
INSERT INTO compo VALUES (3,2,5);
INSERT INTO compo VALUES (3,3,5);
INSERT INTO compo VALUES (4,1,1);
INSERT INTO compo VALUES (4,1,5);
INSERT INTO compo VALUES (4,2,1);
INSERT INTO compo VALUES (4,2,2);
INSERT INTO compo VALUES (4,3,1);
INSERT INTO compo VALUES (4,3,3);
INSERT INTO compo VALUES (4,4,2);
INSERT INTO compo VALUES (4,4,6);

INSERT INTO compo VALUES (5,1,1);
INSERT INTO compo VALUES (5,2,2);
INSERT INTO compo VALUES (5,3,1);
INSERT INTO compo VALUES (5,3,2);
INSERT INTO compo VALUES (5,3,5);



-- interp
INSERT INTO interp VALUES (1,1,1,'vocal');
INSERT INTO interp VALUES (1,1,2,'bandoneon');
INSERT INTO interp VALUES (1,1,4,'bass');
INSERT INTO interp VALUES (1,2,1,'vocal');
INSERT INTO interp VALUES (1,2,1,'guitar');
INSERT INTO interp VALUES (1,3,1,'drum');
INSERT INTO interp VALUES (2,1,3,'vocal');
INSERT INTO interp VALUES (2,1,4,'bass');
INSERT INTO interp VALUES (2,1,5,'bandoneon');
INSERT INTO interp VALUES (2,2,3,'guitar');
INSERT INTO interp VALUES (2,3,3,'vocal');
INSERT INTO interp VALUES (2,3,3,'guitar');
INSERT INTO interp VALUES (3,1,6,'vocal');
INSERT INTO interp VALUES (3,1,4,'bass');
INSERT INTO interp VALUES (3,1,2,'trumpet');
INSERT INTO interp VALUES (3,2,6,'bandoneon');
INSERT INTO interp VALUES (3,2,5,'guitar');
INSERT INTO interp VALUES (3,2,2,'vocal');
INSERT INTO interp VALUES (3,3,6,'vocal');
INSERT INTO interp VALUES (3,3,2,'vocal');
INSERT INTO interp VALUES (4,1,2,'trumpet');
INSERT INTO interp VALUES (4,2,2,'vocal');
INSERT INTO interp VALUES (4,2,5,'guitar');
INSERT INTO interp VALUES (4,2,3,'vocal');
INSERT INTO interp VALUES (4,3,2,'bandoneon');
INSERT INTO interp VALUES (4,4,3,'guitar');
INSERT INTO interp VALUES (3,4,3,'guitar');

-- leader
INSERT INTO leader VALUES (4,2);
INSERT INTO leader VALUES (3,6);
INSERT INTO leader VALUES (2,3);
INSERT INTO leader VALUES (1,1);
