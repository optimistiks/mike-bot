import type { ReactElement } from "react";

import { HomeClient } from "@/app/_components/home-client";
import { isProduction } from "@/env";

function Home(): ReactElement {
  return <HomeClient isProduction={isProduction()} />;
}

export default Home;
