
INSERT INTO position VALUES
  (1,(select current_date-interval '2 days'),1,111,NULL),
  (2,(select current_date-interval '2 days'),1,310,NULL),
  (3,(select current_date-interval '2 days'),1,211,NULL),
  (5,(select current_date-interval '2 days'),1,601,NULL),
  (1,(select current_date-interval '2 days'),2,111,NULL),
  (2,(select current_date-interval '2 days'),2,310,NULL),
  (3,(select current_date-interval '2 days'),2,211,NULL),
  (5,(select current_date-interval '2 days'),2,671,NULL),
  (6,(select current_date-interval '2 days'),2,601,NULL),
  (1,(select current_date-interval '2 days'),3,111,NULL),
  (2,(select current_date-interval '2 days'),3,310,NULL),
  (3,(select current_date-interval '2 days'),3,211,NULL),
  (4,(select current_date-interval '2 days'),3,411,NULL),
  (5,(select current_date-interval '2 days'),3,671,NULL),
  (6,(select current_date-interval '2 days'),3,601,NULL),
  (1,(select current_date-interval '1 day'),1,111,NULL),
  (2,(select current_date-interval '1 day'),1,310,NULL),
  (3,(select current_date-interval '1 day'),1,211,NULL),
  (5,(select current_date-interval '1 day'),1,671,NULL),
  (2,current_date,2,211,'Core Words'),
  (3,current_date,2,310,'Chommel'),
  (5,current_date,2,671,'Mayagil'),
  (6,current_date,2,601,'Core Words');



-