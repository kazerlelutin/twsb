// @refresh reload
import { Link, MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { type ParentProps, Suspense } from "solid-js";
import "./app.css";

const Root = (props: ParentProps) => (
  <MetaProvider>
    <Title>TWSB</Title>
    <Link rel="icon" type="image/svg+xml" href="/twsb-mark.svg" />
    <Suspense>{props.children}</Suspense>
  </MetaProvider>
);

export default function App() {
  return (
    <Router root={Root}>
      <FileRoutes />
    </Router>
  );
}
