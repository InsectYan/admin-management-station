import { Router } from "express";
import { config } from "../../config.js";
import { listProjects, loadProject } from "../artifactStore.js";

const router = Router();

function handleListProjects(req: { params: { userId: string } }, res: import("express").Response) {
  try {
    const projects = listProjects(req.params.userId);
    res.json({ projects });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
}

function handleLoadProject(
  req: { params: { userId: string; projectId: string } },
  res: import("express").Response,
) {
  try {
    const project = loadProject(req.params.userId, req.params.projectId);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    res.json(project);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/novel/:userId/projects", handleListProjects);
router.get("/novel/:userId/project/:projectId", handleLoadProject);

router.get("/creator/:creatorId/projects", (req, res) => {
  handleListProjects({ params: { userId: req.params.creatorId } }, res);
});

router.get("/creator/:creatorId/project/:projectId", (req, res) => {
  handleLoadProject(
    { params: { userId: req.params.creatorId, projectId: req.params.projectId } },
    res,
  );
});

router.get("/health", (_req, res) => {
  res.json({
    agent_server: "ok",
    novel_bff_url: config.novelBffUrl,
  });
});

export default router;
