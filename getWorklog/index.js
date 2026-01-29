const sql = require("mssql");

module.exports = async function (context, req) {
  // --- CORS (żeby przeglądarka nie blokowała) ---
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // 1) Preflight (OPTIONS) – przeglądarka wysyła to przed POST
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  // Połączenie do bazy
  const connStr = process.env.SQL_CONNECTION_STRING;
  if (!connStr) {
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: "Brak SQL_CONNECTION_STRING w Application settings",
    };
    return;
  }

  try {
    await sql.connect(connStr);

    // 2) GET – to co miałeś: zwraca aktualny czas z SQL
    if (req.method === "GET") {
      const result = await sql.query`SELECT GETDATE() AS now`;
      context.res = {
        status: 200,
        headers: corsHeaders,
        body: result.recordset,
      };
      return;
    }

    // 3) POST – na start zrobimy prosty test: zapis do tabeli Worklog
    if (req.method === "POST") {
      const data = req.body;

      // Minimalna walidacja
      if (!data) {
        context.res = {
          status: 400,
          headers: corsHeaders,
          body: { message: "Brak danych w body" },
        };
        return;
      }

      // UWAGA: musisz mieć tabelę w SQL.
      // Na start zakładam tabelę: Worklog (payload NVARCHAR(MAX), createdAt DATETIME)
      // Jeśli masz inną tabelę/kolumny, powiesz mi i dopasuję.
      await sql.query`
        INSERT INTO Worklog (payload, createdAt)
        VALUES (${JSON.stringify(data)}, GETDATE())
      `;

      context.res = {
        status: 200,
        headers: corsHeaders,
        body: { ok: true },
      };
      return;
    }

    // Inne metody
    context.res = {
      status: 405,
      headers: corsHeaders,
      body: "Method not allowed",
    };
  } catch (err) {
    context.log.error("SQL ERROR:", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { message: "Błąd SQL", error: err.message },
    };
  } finally {
    // Bezpieczne zamknięcie połączenia
    try { await sql.close(); } catch {}
  }
};
