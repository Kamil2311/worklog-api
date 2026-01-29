const sql = require("mssql");

module.exports = async function (context, req) {
  try {
    const connStr = process.env.SQL_CONNECTION_STRING;

    if (!connStr) {
      context.res = {
        status: 500,
        body: "Brak SQL_CONNECTION_STRING w Application settings"
      };
      return;
    }

    await sql.connect(connStr);
    const result = await sql.query`SELECT GETDATE() AS now`;
    await sql.close();

    context.res = {
      status: 200,
      body: result.recordset
    };
  } catch (err) {
    context.log.error("SQL ERROR:", err);
    context.res = {
      status: 500,
      body: {
        message: "Błąd SQL",
        error: err.message
      }
    };
  }
};
