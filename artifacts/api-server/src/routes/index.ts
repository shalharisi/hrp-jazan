import { Router, type IRouter } from "express";
import healthRouter from "./health";
import referenceRouter from "./reference";
import patientsRouter from "./patients";
import pregnanciesRouter from "./pregnancies";
import appointmentsRouter from "./appointments";
import dashboardRouter from "./dashboard";
import alertsRouter from "./alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(referenceRouter);
router.use(patientsRouter);
router.use(pregnanciesRouter);
router.use(appointmentsRouter);
router.use(dashboardRouter);
router.use(alertsRouter);

export default router;
