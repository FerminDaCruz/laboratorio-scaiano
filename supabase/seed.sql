-- Datos iniciales reales del laboratorio.
--
-- Catálogo de trabajos y precios, tomados de la lista de precios en papel
-- (ver docs/fuentes/transcripcion-precios.md), columna "Marzo 26".
-- Los importes del papel están en miles de pesos: 150 en el papel = $ 150.000.
--
-- Los doctores NO están acá: tienen datos personales y van en
-- supabase/seed.doctores.local.sql, que no se versiona.

-- ------------------------------------------------------- obras sociales
-- TODO: el listado de odontólogos en papel no trae obra social. Estas son las
-- más comunes, para poder operar; hay que confirmarlas con Damián.
insert into public.obras_sociales (codigo, nombre) values
  ('OSDE',  'OSDE'),
  ('SWISS', 'Swiss Medical'),
  ('IOMA',  'IOMA'),
  ('PAMI',  'PAMI'),
  ('PART',  'Particular');

-- -------------------------------------------------------------- trabajos
-- El papel no tiene códigos cortos: los de acá se armaron a partir del nombre,
-- y son los que se tipean al cargar una orden.
insert into public.trabajos (codigo, titulo, descripcion) values
  ('CONS',    'A consultar',                          'El precio se acuerda en el momento'),
  ('RETOT',   'Retirar OT',                           'Movimiento administrativo, sin cargo'),
  ('ATT',     'Atache c/ teflón',                     null),
  ('BAN2',    'Bandeja s/ 2 implantes',               null),
  ('BAN3',    'Bandeja s/ 3 implantes',               null),
  ('BAN4',    'Bandeja s/ 4 implantes',               null),
  ('BAN5',    'Bandeja s/ 5 implantes',               null),
  ('BAN6',    'Bandeja s/ 6 implantes',               null),
  ('BARP',    'Barra pasiva',                         null),
  ('BAR2',    'Barra s/ 2 implantes',                 null),
  ('BAR3',    'Barra s/ 3 implantes',                 null),
  ('BAR4',    'Barra s/ 4 implantes',                 null),
  ('BAR5',    'Barra s/ 5 implantes',                 null),
  ('BAR6',    'Barra s/ 6 implantes',                 null),
  ('BIZ',     'Bizcochado',                           null),
  ('BIZT',    'Bizcochado a término',                 null),
  ('PAS',     'Cada pasante',                         null),
  ('CDL',     'Carilla de disilicato de litio',       null),
  ('CASM',    'Casquete metálico',                    null),
  ('CASR',    'Casquete roscado CAD CAM',             null),
  ('CAZT',    'Cazoleta p/ teflón',                   null),
  ('CHO',     'Cerámica de hombro',                   null),
  ('UCLACAD', 'Colado de UCLA CAD CAM',               null),
  ('UCLACOM', 'Colado de UCLA comercial',             null),
  ('CCER',    'Corona Ceramage',                      null),
  ('CUEC',    'Corona cerámica UEC CAD CAM',          null),
  ('CDISE',   'Corona DISI estratificada',            null),
  ('CDISM',   'Corona DISI monolítica',               null),
  ('CEC',     'Corona entera colada',                 null),
  ('CMAQ',    'Corona maqueta p/ Zr',                 null),
  ('CMC',     'Corona metalocerámica',                null),
  ('CPMMA',   'Corona PMMA monocromática',            null),
  ('CPMML',   'Corona PMMA multilayer',               null),
  ('CZRE',    'Corona ZR estratificada',              null),
  ('CZRM',    'Corona ZR monolítica',                 null),
  ('NPR',     'Nueva prueba (acrílico)',              null),
  ('PARP',    'Paralelización de pilar',              null),
  ('PCBL',    'Placa de blanqueamiento',              null),
  ('PCRE',    'Placa de relajación elástica',         'Vacuum'),
  ('PCRR',    'Placa de relajación rígida',           'Vacuum'),
  ('PAGPD',   'Perno Ag-Pd',                          null),
  ('PCER',    'Perno ceramizado',                     null),
  ('PATOV',   'Perno con atache overdenture',         null),
  ('PPAS',    'Perno con pasante',                    null),
  ('PDIR',    'Perno directo / indirecto',            null),
  ('POPA',    'Perno opacificado',                    null),
  ('PRICH',   'Perno Richmond',                       null),
  ('PSEC',    'Perno seccionado',                     null),
  ('PILZR',   'Pilar personalizado Zr',               null),
  ('PILCAD',  'Pilar personalizado CAD CAM',          null),
  ('PROB',    'Protector bucal',                      null),
  ('PSBA',    'Prótesis s/ barras o ataches',         null),
  ('PUL',     'Pulir metal',                          null),
  ('RETC',    'Retoque (cerámica)',                   null),
  ('RETM',    'Retoque (metal)',                      null),
  ('ROD',     'Rodete de prueba, foto o impreso',     null),
  ('FRPMMA',  'Servicio de fresado PMMA',             null),
  ('FRWAX',   'Servicio de fresado wax',              null),
  ('FRZR16',  'Fresado / sinterizado Zr ML 14 a 16 mm', null),
  ('FRZR20',  'Fresado / sinterizado Zr ML 18 a 20 mm', null),
  ('FRZR25',  'Fresado / sinterizado Zr ML 25 mm',    null),
  ('INY',     'Servicio inyectado',                   null),
  ('SOL',     'Soldadura',                            null),
  ('TEF',     'Teflón',                               null);

-- --------------------------------------------------------------- precios
-- Lista de marzo de 2026. Los trabajos que en el papel no tienen importe
-- ("A consultar", "Retirar OT", "Soldadura", "Teflón", retoques, etc.) quedan
-- sin precio: el sistema no deja usarlos en una orden hasta que se les cargue uno.
insert into public.precios_trabajo (trabajo_id, precio, vigente_desde)
select t.id, p.precio, date '2026-03-01'
  from public.trabajos t
  join (values
    ('ATT',     105000.00),
    ('BAN2',    320000.00),
    ('BAN3',    490000.00),
    ('BAN4',    690000.00),
    ('BAN5',    825000.00),
    ('BAN6',    920000.00),
    ('BARP',    105000.00),
    ('BAR2',    310000.00),
    ('BAR3',    450000.00),
    ('BAR4',    600000.00),
    ('BAR5',    700000.00),
    ('BAR6',    790000.00),
    ('BIZ',      75000.00),
    ('BIZT',     75000.00),
    ('PAS',      15000.00),
    ('CDL',     180000.00),
    ('CASM',     75000.00),
    ('CASR',     80000.00),
    ('CHO',      35000.00),
    ('UCLACAD',  90000.00),
    ('UCLACOM',  90000.00),
    ('CCER',    150000.00),
    ('CUEC',    160000.00),
    ('CDISM',   160000.00),
    ('CEC',     120000.00),
    ('CMAQ',      9000.00),
    ('CMC',     150000.00),
    ('CPMMA',    60000.00),
    ('CPMML',    70000.00),
    ('CZRE',    175000.00),
    ('CZRM',    155000.00),
    ('PARP',     35000.00),
    ('PCBL',     60000.00),
    ('PCRE',     58000.00),
    ('PCRR',     58000.00),
    ('PCER',     80000.00),
    ('PATOV',   105000.00),
    ('PPAS',     66000.00),
    ('PDIR',     58000.00),
    ('POPA',     80000.00),
    ('PRICH',    80000.00),
    ('PSEC',     95000.00),
    ('PILZR',   100000.00),
    ('PILCAD',  100000.00),
    ('PROB',     67000.00),
    ('PSBA',    180000.00),
    ('ROD',      20000.00),
    ('FRPMMA',   25000.00),
    ('FRWAX',    12000.00),
    ('FRZR16',   45000.00),
    ('FRZR20',   51000.00),
    ('FRZR25',   55000.00)
  ) as p (codigo, precio) on p.codigo = t.codigo;
