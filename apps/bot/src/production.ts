import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

// eslint-disable-next-line init-declarations -- assigned on first getProductionPool call
let productionPool: Pool | undefined;

function getProductionPool(connectionString: string): Pool {
  if (productionPool === undefined) {
    productionPool = new Pool({ connectionString });
    attachDatabasePool(productionPool);
  }

  return productionPool;
}

export { getProductionPool };
