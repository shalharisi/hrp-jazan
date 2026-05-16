import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import referenceRouter from "./reference";
import patientsRouter from "./patients";
import pregnanciesRouter from "./pregnancies";
import appointmentsRouter from "./appointments";
import dashboardRouter from "./dashboard";
import alertsRouter from "./alerts";
import usersRouter from "./users";
import auditLogsRouter from "./audit-logs";
import { requireAuth } from "../lib/auth";
import { auditMiddleware } from "../lib/audit";

const router: IRouter = Router();

// Public
router.use(healthRouter);
router.use(authRouter);

// All routes below require a valid JWT
router.use(requireAuth);

// Read-only and reference — accessible to all authenticated roles (including viewer)
router.use(referenceRouter);
router.use(dashboardRouter);
router.use(alertsRouter);

// Patient / pregnancy / appointment routers —
// Each router enforces write-access internally for mutation methods.
// GET routes remain accessible to all authenticated users including viewers.
router.use(auditMiddleware("patients"), patientsRouter);
router.use(auditMiddleware("pregnancies"), pregnanciesRouter);
router.use(auditMiddleware("appointments"), appointmentsRouter);

// Admin-only routes (enforced inside the routers)
router.use(usersRouter);
router.use(auditLogsRouter);

export default router;
