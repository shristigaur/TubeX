import { Router } from 'express';
import { checkHealth } from '../controllers/health.controller.js';
const router = Router();
router.get('/', checkHealth);
export default router;
//# sourceMappingURL=health.routes.js.map