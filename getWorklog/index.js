const sql = require("mssql");
 
let pool; 
 
module.exports = async function (context, req) {
 
  // =========================
  // CORS / preflight
  // =========================
  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
    return;
  }
 
  const ok = (status, body) => ({
    status,
    body,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
 
  const connStr = process.env.SQL_CONNECTION_STRING;
  if (!connStr) {
    context.res = ok(500, { message: "Brak SQL_CONNECTION_STRING" });
    return;
  }
 
  try {
    // =========================
    // SQL pool (reuse)
    // =========================
    if (!pool) {
      pool = await sql.connect(connStr);
    }
 
    // =========================
    // GET – pobierz board
    // =========================
    if (req.method === "GET") {
      const user = (req.query.user || "").trim();
      const year = parseInt(req.query.year, 10);
      const month = String(req.query.month || "").padStart(2, "0");
 
      if (!user || !year || !month) {
        context.res = ok(400, {
          message: "Brak parametrow: user, year, month",
        });
        return;
      }
 
      const result = await pool
        .request()
        .input("userName", sql.NVarChar(100), user)
        .input("year", sql.Int, year)
        .input("month", sql.Char(2), month)
        .query(`
          SELECT dataJson
          FROM dbo.WorklogBoard
          WHERE userName=@userName
            AND [year]=@year
            AND [month]=@month
        `);
 
      // brak rekordu = OK, brak danych
      if (!result.recordset.length) {
        context.res = ok(200, null);
        return;
      }
 
      const dataJson = result.recordset[0].dataJson;
 
      // NULL / pusty
      if (!dataJson) {
        context.res = ok(200, null);
        return;
      }
 
      // bezpieczne parsowanie
      try {
        context.res = ok(200, JSON.parse(dataJson));
      } catch (e) {
        context.log.error("Invalid JSON in DB", {
          user,
          year,
          month,
          dataJson,
        });
        context.res = ok(500, {
          message: "Niepoprawny JSON w bazie danych",
        });
      }
      return;
    }
 
    // =========================
    // POST – zapisz board
    // =========================
    if (req.method === "POST") {
      const body = req.body || {};
 
      const user = (body.user || "").trim();
      const year = parseInt(body.year, 10);
      const month = String(body.month || "").padStart(2, "0");
      const data = body.data;
 
      if (!user || !year || !month || !data) {
        context.res = ok(400, {
          message: "Brak w body: user, year, month, data",
        });
        return;
      }
 
      let dataJson;
      try {
        dataJson = JSON.stringify(data);
      } catch (e) {
        context.res = ok(400, {
          message: "Nie można zamienić data na JSON",
        });
        return;
      }
 
      await pool
        .request()
        .input("userName", sql.NVarChar(100), user)
        .input("year", sql.Int, year)
        .input("month", sql.Char(2), month)
        .input("dataJson", sql.NVarChar(sql.MAX), dataJson)
        .query(`
          MERGE dbo.WorklogBoard AS t
          USING (
            SELECT
              @userName AS userName,
              @year     AS [year],
              @month    AS [month]
          ) AS s
          ON (
            t.userName = s.userName AND
            t.[year]   = s.[year]   AND
            t.[month]  = s.[month]
          )
          WHEN MATCHED THEN
            UPDATE SET
              dataJson  = @dataJson,
              updatedAt = SYSDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (userName, [year], [month], dataJson, updatedAt)
            VALUES (@userName, @year, @month, @dataJson, SYSDATETIME());
        `);
 
      context.res = ok(200, { ok: true });
      return;
    }
 
    // =========================
    // Inne metody
    // =========================
    context.res = ok(405, { message: "Method not allowed" });
 
  } catch (err) {
    context.log.error("API ERROR:", err);
    context.res = ok(500, {
      message: "Błąd serwera",
      error: err.message,
    });
  }
};
``
