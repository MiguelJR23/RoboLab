-- RoboLab - tabelas (MySQL 8 ou MariaDB 10.5+)
--
-- O servidor cria estas tabelas sozinho ao iniciar (CREATE TABLE IF NOT EXISTS),
-- então normalmente você não precisa executar este arquivo.
-- Para executar manualmente, crie o banco antes e selecione-o.
-- Cada visitante só enxerga os próprios dados (coluna visitante_id).

CREATE TABLE IF NOT EXISTS cenarios (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  visitante_id  CHAR(36)      NOT NULL,
  nome          VARCHAR(40)   NOT NULL,
  descricao     VARCHAR(255)  NOT NULL DEFAULT '',
  configuracao  LONGTEXT      NOT NULL,
  criado_em     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_cenarios_visitante (visitante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- cenario_id é NULL quando o teste foi feito em um cenário predefinido
-- (que existe só no site) ou em um percurso ainda não salvo.
CREATE TABLE IF NOT EXISTS resultados (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  visitante_id   CHAR(36)      NOT NULL,
  cenario_id     INT UNSIGNED  NULL,
  cenario_nome   VARCHAR(40)   NOT NULL,
  tentativa      INT UNSIGNED  NOT NULL,
  tempo          DECIMAL(8,1)  NOT NULL,
  colisoes       INT UNSIGNED  NOT NULL DEFAULT 0,
  passos         INT UNSIGNED  NOT NULL DEFAULT 0,
  concluido      TINYINT(1)    NOT NULL,
  motivo         VARCHAR(120)  NOT NULL DEFAULT '',
  ruido          TINYINT(1)    NOT NULL DEFAULT 0,
  executado_em   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_resultados_visitante (visitante_id),
  INDEX idx_resultados_cenario (cenario_id),
  CONSTRAINT fk_resultados_cenario
    FOREIGN KEY (cenario_id) REFERENCES cenarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS visitas (
  visitante_id     CHAR(36)      NOT NULL,
  primeiro_acesso  DATETIME      NOT NULL,
  ultimo_acesso    DATETIME      NOT NULL,
  acessos          INT UNSIGNED  NOT NULL DEFAULT 1,
  PRIMARY KEY (visitante_id),
  INDEX idx_visitas_primeiro (primeiro_acesso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;