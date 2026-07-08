import { createRouter, createWebHistory } from "vue-router";
import KotBoard from "../components/KotBoard.vue";

const routes = [
  {
    path: "/:production?",
    name: "KotBoard",
    component: KotBoard,
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory("/URYMosaic/"),
  routes,
});

export default router;
