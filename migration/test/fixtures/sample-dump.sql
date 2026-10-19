-- Fixture de pruebas con el mismo formato que el dump real (una fila por línea).
-- La fila 2 termina en CRLF y la 3 tiene un espacio final.
-- Cifras esperadas:
--   leídos 23; incluidos 19; excluidos CDT 2 (ids 8, 9), USD 1 (id 10), monto cero 1 (id 22)
--   candidatas 10; transferencias 2 (11→12, 17→19); descartados por fusión 1 (13↔14)
--   patas sueltas 4 (15, 16, 18, 20); sin pareja 13; registros 15; ingresos 6; egresos 7
--   saldos: cash -1.925.400,00; nequi 196.999,50; bancolombia 955.000,00; alamano 0,00; global66 30.000,00
CREATE TABLE `location` (
    `id` int(11) NOT NULL,
    `location` varchar(255) DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO `location`(`id`, `location`, `currency`, `selectVisibility`) VALUES ('1', 'Efectivo', 'COP', '1');
CREATE TABLE `cdtmovements` (
    `id` int(11) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `movements` (
    `id` int(11) NOT NULL,
    `description` text DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('1', 'Ingreso Daniela J', '94100.00', '2021-07-22', '1', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('2', 'Compra mercado ñandú', '-25000.50', '2021-07-23', '2', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('3', 'Pago nómina', '1000000.00', '2021-07-25', '5', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('4', 'Recarga A la mano', '5000.00', '2021-08-01', '6', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('5', 'Retiro A la mano', '-5000.00', '2021-08-02', '6', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('6', 'Ingreso Global66', '30000.00', '2021-08-03', '7', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('7', 'Almuerzo', '-12000.00', '2021-08-04', '8', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('8', 'CDT Bancamia Iniciado', '3000000.00', '0000-00-00', '3', 1);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('9', 'Intereses CDT', '1000.00', '2023-01-01', '9', 2);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('10', 'Fiverr', '8.00', '2022-01-22', '4', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('11', 'Transferencia a Nequi', '-50000.00', '2022-02-01', '5', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('12', 'Transferencia desde Bancolombia', '50000.00', '2022-02-01', '2', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('13', 'Transferencia a Bolsillo', '-20000.00', '2022-02-02', '1', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('14', 'Transferencia desde Efectivo', '20000.00', '2022-02-02', '8', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('15', 'Transferencia a Nequi', '-10000.00', '2022-03-12', '1', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('16', 'Transferencia desde Efectivo', '179000.00', '2022-03-12', '2', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('17', 'Transferencia a Efectivo', '-7000.00', '2022-04-01', '2', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('18', 'Transferencia a Efectivo', '-7000.00', '2022-04-01', '5', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('19', 'Transferencia desde Nequi', '7000.00', '2022-04-01', '1', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('20', 'Transferencia a CDT', '-2000000.00', '2023-08-24', '1', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('21', 'Transferencia Santiago Baca', '12000.00', '2026-03-31', '5', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('22', 'Ajuste sin valor', '0.00', '2024-01-01', '5', NULL);
INSERT INTO movements (`id`, `description`, `amount`, `movementDate`, `location`, `cdt`) VALUES ('23', 'Café', '-4500.00', '2024-01-02', '1', NULL);
CREATE TABLE `transfers` (
    `id` int(11) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO transfers(id, currentLocation, newLocation, amount, transferDate) VALUES ('1', '5', '2', '50000.00', '2022-02-01');
CREATE TABLE `usmovements` (
    `id` int(11) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO usmovements(`id`, `description`, `amount`, `movementDate`, `location`) VALUES ('1', 'Fiverr: Conversión PDF a EPUB', '8.00', '2022-01-22', '4');
