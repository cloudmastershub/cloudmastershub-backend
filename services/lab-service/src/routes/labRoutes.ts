import { Router } from 'express';
import { 
  getAllLabs,
  getLabById,
  createLab,
  updateLab,
  deleteLab,
  getLabByCourse
} from '../controllers/labController';

const router = Router();

router.get('/', getAllLabs);
router.get('/:id', getLabById);
router.get('/course/:courseId', getLabByCourse);
router.post('/', createLab);
router.put('/:id', updateLab);
router.delete('/:id', deleteLab);

export default router;