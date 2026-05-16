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
import { requireAuth, requireWriteAccess } from "../lib/auth";
import { auditMiddleware } from "../lib/audit";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use(authRouter);

// Protected routes — require valid JWT on all below
router.use(requireAuth);

// Read-only routes (any authenticated user)
router.use(referenceRouter);
router.use(dashboardRouter);
router.use(alertsRouter);

// Write-protected routes (not viewer)
router.use(requireWriteAccess);
router.use(auditMiddleware("patients"), patientsRouter);
router.use(auditMiddleware("pregnancies"), pregnanciesRouter);
router.use(auditMiddleware("appointments"), appointmentsRouter);

// Admin-only routes
router.use(usersRouter);
router.use(auditLogsRouter);

export default router;
