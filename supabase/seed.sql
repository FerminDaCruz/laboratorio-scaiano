-- E1 · Datos de prueba. Se corre sobre una base recién migrada.
-- Son inventados: sirven para probar las pantallas hasta que se destrabe E12.

insert into public.obras_sociales (codigo, nombre) values
  ('OSDE',  'OSDE'),
  ('SWISS', 'Swiss Medical'),
  ('IOMA',  'IOMA'),
  ('PAMI',  'PAMI'),
  ('PART',  'Particular');

insert into public.trabajos (codigo, titulo, descripcion) values
  ('PCA',  'Prótesis completa acrílica',      'Superior o inferior, acrílico termocurado'),
  ('PPR',  'Prótesis parcial removible',      'Con ganchos de cromo cobalto'),
  ('PPA',  'Prótesis parcial acrílica',       null),
  ('CMC',  'Corona metal-cerámica',           'Metal base con cerámica estratificada'),
  ('CZI',  'Corona de zirconio',              'Zirconio monolítico'),
  ('CPJ',  'Corona de porcelana pura',        null),
  ('IPJ',  'Incrustación',                    'Inlay / onlay'),
  ('PUE',  'Puente (por elemento)',           'Se cobra por pieza del tramo'),
  ('ESQ',  'Esqueleto de cromo cobalto',      null),
  ('PRO',  'Provisorio',                      'Acrílico de uso temporario'),
  ('COM',  'Compostura',                      'Arreglo de prótesis'),
  ('REB',  'Rebase',                          'Rebase de prótesis existente'),
  ('PLQ',  'Placa de bruxismo',               'Férula de descarga'),
  ('MOD',  'Modelo de estudio',               null),
  ('CUB',  'Cubeta individual',               null);

-- Precios iniciales (vigencia hace tres meses) y un aumento del 20% hace un mes.
insert into public.precios_trabajo (trabajo_id, precio, vigente_desde)
select t.id, p.precio, current_date - interval '3 months'
  from public.trabajos t
  join (values
    ('PCA', 185000.00), ('PPR', 164000.00), ('PPA',  96000.00), ('CMC',  78000.00),
    ('CZI', 132000.00), ('CPJ',  88000.00), ('IPJ',  61000.00), ('PUE',  74000.00),
    ('ESQ', 148000.00), ('PRO',  28000.00), ('COM',  22000.00), ('REB',  36000.00),
    ('PLQ',  69000.00), ('MOD',  12000.00), ('CUB',  15000.00)
  ) as p (codigo, precio) on p.codigo = t.codigo;

insert into public.precios_trabajo (trabajo_id, precio, vigente_desde)
select p.trabajo_id, round(p.precio * 1.20, 2), current_date - interval '1 month'
  from public.precios_trabajo p
 where p.vigente_desde = current_date - interval '3 months';

insert into public.doctores (ficha, nombre, domicilio, piso, departamento, localidad, telefono, obra_social_id, fecha_alta)
select d.ficha, d.nombre, d.domicilio, d.piso, d.departamento, d.localidad, d.telefono,
       (select id from public.obras_sociales where codigo = d.obra), d.alta::date
  from (values
    (101, 'Dra. Laura Méndez',        'Mitre 455',            '2', 'B',  'Bariloche',      '294 4421188', 'OSDE',  '2019-03-12'),
    (102, 'Dr. Pablo Ferreyra',       'Moreno 1120',          null, null, 'Bariloche',     '294 4425510', 'SWISS', '2019-06-01'),
    (103, 'Dra. Silvia Acosta',       'Elflein 230',          '1', 'A',  'Bariloche',      '294 4432007', 'OSDE',  '2020-02-18'),
    (104, 'Dr. Martín Quiroga',       'Av. Bustillo km 4,5',  null, null, 'Bariloche',     '294 4446621', 'PART',  '2020-08-05'),
    (105, 'Dra. Cecilia Bustos',      'Palacios 88',          '3', 'C',  'Bariloche',      '294 4415533', 'IOMA',  '2021-01-20'),
    (106, 'Dr. Andrés Villalba',      'Juramento 740',        null, null, 'Bariloche',     '294 4428890', 'SWISS', '2021-04-14'),
    (107, 'Dra. Mariana Soto',        'Onelli 310',           '1', 'B',  'Bariloche',      '294 4433412', 'PART',  '2021-09-30'),
    (108, 'Dr. Gustavo Paredes',      'Vice Alte. O''Connor 50', null, null, 'Bariloche',  '294 4420077', 'OSDE',  '2022-03-02'),
    (109, 'Dra. Verónica Linares',    'Beschtedt 1240',       '2', 'A',  'Bariloche',      '294 4451199', 'PAMI',  '2022-05-11'),
    (110, 'Dr. Hernán Cabrera',       'Tiscornia 905',        null, null, 'Bariloche',     '294 4467788', 'PART',  '2022-07-19'),
    (111, 'Dra. Paula Ibarra',        '12 de Octubre 1865',   '4', 'D',  'Bariloche',      '294 4412244', 'SWISS', '2022-11-08'),
    (112, 'Dr. Ramiro Ledesma',       'San Martín 320',       null, null, 'Dina Huapi',    '294 4698012', 'PART',  '2023-02-27'),
    (113, 'Dra. Natalia Giménez',     'Los Notros 45',        null, null, 'Dina Huapi',    '294 4698345', 'IOMA',  '2023-04-16'),
    (114, 'Dr. Federico Ocampo',      'Angel Gallardo 630',   '1', 'C',  'Bariloche',      '294 4427766', 'OSDE',  '2023-08-21'),
    (115, 'Dra. Carolina Ruiz Díaz',  'Rolando 180',          null, null, 'Bariloche',     '294 4419922', 'PART',  '2024-01-09'),
    (116, 'Dr. Esteban Morales',      'Perito Moreno 2210',   '2', 'B',  'Bariloche',      '294 4434455', 'SWISS', '2024-03-25'),
    (117, 'Dra. Jimena Alcaraz',      'Frey 70',              null, null, 'Bariloche',     '294 4424488', 'PART',  '2024-06-13'),
    (118, 'Dr. Lucas Sandoval',       'Av. Los Pioneros km 2','1', 'A',  'Bariloche',      '294 4471234', 'OSDE',  '2024-10-02'),
    (119, 'Dra. Romina Figueroa',     'Quaglia 260',          '3', 'B',  'Bariloche',      '294 4426699', 'IOMA',  '2025-02-17'),
    (120, 'Dr. Nicolás Peralta',      'Ruta 40 km 1998',      null, null, 'Villa La Angostura', '294 4941188', 'PART', '2025-05-29')
  ) as d (ficha, nombre, domicilio, piso, departamento, localidad, telefono, obra, alta);
