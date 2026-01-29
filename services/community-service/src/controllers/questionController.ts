import { Response, NextFunction } from 'express';
import { AuthRequest } from '@cloudmastershub/middleware';
import { Question, Answer } from '../models';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export const getQuestions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const tag = req.query.tag as string;
    const category = req.query.category as string;
    const courseId = req.query.courseId as string;
    const sort = req.query.sort as string;

    let query: any = {};

    if (status) {
      query.status = status;
    }
    if (tag) {
      query.tags = tag;
    }
    if (category) {
      query.category = category;
    }
    if (courseId) {
      query.courseId = courseId;
    }

    let sortOptions: any = { createdAt: -1 };
    if (sort === 'votes') {
      sortOptions = { upvotes: -1, createdAt: -1 };
    } else if (sort === 'answers') {
      sortOptions = { answerCount: -1, createdAt: -1 };
    } else if (sort === 'views') {
      sortOptions = { viewCount: -1, createdAt: -1 };
    } else if (sort === 'unanswered') {
      query.answerCount = 0;
      sortOptions = { createdAt: -1 };
    }

    const [questions, total] = await Promise.all([
      Question.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      Question.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        questions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching questions:', error);
    next(error);
  }
};

export const getQuestionById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const question = await Question.findById(id);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    await Question.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [answers, totalAnswers] = await Promise.all([
      Answer.find({ questionId: id })
        .sort({ isAccepted: -1, upvotes: -1, createdAt: 1 })
        .skip(skip)
        .limit(limit),
      Answer.countDocuments({ questionId: id })
    ]);

    let userVote = 0;
    if (userId) {
      const voter = question.voters.find(v => v.oderId === userId);
      if (voter) {
        userVote = voter.vote;
      }
    }

    res.json({
      success: true,
      data: {
        question: {
          ...question.toJSON(),
          userVote
        },
        answers,
        pagination: {
          page,
          limit,
          total: totalAnswers,
          totalPages: Math.ceil(totalAnswers / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching question:', error);
    next(error);
  }
};

export const createQuestion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { title, content, tags, category, courseId, bountyPoints } = req.body;

    if (!title || !content) {
      throw new BadRequestError('Title and content are required');
    }

    const slug = `${generateSlug(title)}-${Date.now().toString(36)}`;

    const question = new Question({
      title,
      slug,
      content,
      authorId: userId,
      authorName: req.user?.email?.split('@')[0] || 'User',
      tags: tags || [],
      category,
      courseId,
      bountyPoints,
      bountyExpiresAt: bountyPoints ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined
    });

    await question.save();

    logger.info(`Question created: ${question.title} by ${userId}`);

    res.status(201).json({
      success: true,
      data: question
    });
  } catch (error) {
    logger.error('Error creating question:', error);
    next(error);
  }
};

export const updateQuestion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const question = await Question.findById(id);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    if (question.authorId !== userId) {
      throw new ForbiddenError('You can only edit your own questions');
    }

    const { title, content, tags, category } = req.body;

    if (title !== undefined) {
      question.title = title;
      question.slug = `${generateSlug(title)}-${Date.now().toString(36)}`;
    }
    if (content !== undefined) question.content = content;
    if (tags !== undefined) question.tags = tags;
    if (category !== undefined) question.category = category;

    question.isEdited = true;
    question.editedAt = new Date();

    await question.save();

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    logger.error('Error updating question:', error);
    next(error);
  }
};

export const deleteQuestion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const userRoles = req.userRoles || [];

    const question = await Question.findById(id);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    const isModerator = userRoles.includes('admin') || userRoles.includes('moderator');
    if (question.authorId !== userId && !isModerator) {
      throw new ForbiddenError('You can only delete your own questions');
    }

    await Answer.deleteMany({ questionId: id });
    await Question.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting question:', error);
    next(error);
  }
};

export const voteQuestion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { vote } = req.body;

    if (vote !== 1 && vote !== -1) {
      throw new BadRequestError('Vote must be 1 (upvote) or -1 (downvote)');
    }

    const question = await Question.findById(id);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    if (question.authorId === userId) {
      throw new ForbiddenError('You cannot vote on your own question');
    }

    const existingVoteIndex = question.voters.findIndex(v => v.oderId === userId);

    if (existingVoteIndex !== -1) {
      const existingVote = question.voters[existingVoteIndex].vote;

      if (existingVote === vote) {
        question.voters.splice(existingVoteIndex, 1);
        if (vote === 1) {
          question.upvotes -= 1;
        } else {
          question.downvotes -= 1;
        }
      } else {
        question.voters[existingVoteIndex].vote = vote;
        if (vote === 1) {
          question.upvotes += 1;
          question.downvotes -= 1;
        } else {
          question.upvotes -= 1;
          question.downvotes += 1;
        }
      }
    } else {
      question.voters.push({ oderId: userId, vote });
      if (vote === 1) {
        question.upvotes += 1;
      } else {
        question.downvotes += 1;
      }
    }

    await question.save();

    res.json({
      success: true,
      data: {
        upvotes: question.upvotes,
        downvotes: question.downvotes,
        score: question.upvotes - question.downvotes
      }
    });
  } catch (error) {
    logger.error('Error voting on question:', error);
    next(error);
  }
};

export const createAnswer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: questionId } = req.params;
    const userId = req.userId!;
    const { content } = req.body;

    if (!content) {
      throw new BadRequestError('Content is required');
    }

    const question = await Question.findById(questionId);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    if (question.status === 'closed') {
      throw new ForbiddenError('This question is closed');
    }

    const answer = new Answer({
      questionId,
      authorId: userId,
      authorName: req.user?.email?.split('@')[0] || 'User',
      content
    });

    await answer.save();

    await Question.findByIdAndUpdate(questionId, {
      $inc: { answerCount: 1 }
    });

    logger.info(`Answer created for question ${questionId} by ${userId}`);

    res.status(201).json({
      success: true,
      data: answer
    });
  } catch (error) {
    logger.error('Error creating answer:', error);
    next(error);
  }
};

export const updateAnswer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { answerId } = req.params;
    const userId = req.userId!;
    const { content } = req.body;

    const answer = await Answer.findById(answerId);
    if (!answer) {
      throw new NotFoundError('Answer not found');
    }

    if (answer.authorId !== userId) {
      throw new ForbiddenError('You can only edit your own answers');
    }

    answer.content = content;
    answer.isEdited = true;
    answer.editedAt = new Date();

    await answer.save();

    res.json({
      success: true,
      data: answer
    });
  } catch (error) {
    logger.error('Error updating answer:', error);
    next(error);
  }
};

export const deleteAnswer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { answerId } = req.params;
    const userId = req.userId!;
    const userRoles = req.userRoles || [];

    const answer = await Answer.findById(answerId);
    if (!answer) {
      throw new NotFoundError('Answer not found');
    }

    const isModerator = userRoles.includes('admin') || userRoles.includes('moderator');
    if (answer.authorId !== userId && !isModerator) {
      throw new ForbiddenError('You can only delete your own answers');
    }

    const question = await Question.findById(answer.questionId);
    if (question && question.acceptedAnswerId?.toString() === answerId) {
      question.acceptedAnswerId = undefined;
      question.status = 'open';
      await question.save();
    }

    await Answer.findByIdAndDelete(answerId);

    await Question.findByIdAndUpdate(answer.questionId, {
      $inc: { answerCount: -1 }
    });

    res.json({
      success: true,
      message: 'Answer deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting answer:', error);
    next(error);
  }
};

export const acceptAnswer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { answerId } = req.params;
    const userId = req.userId!;

    const answer = await Answer.findById(answerId);
    if (!answer) {
      throw new NotFoundError('Answer not found');
    }

    const question = await Question.findById(answer.questionId);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    if (question.authorId !== userId) {
      throw new ForbiddenError('Only the question author can accept an answer');
    }

    if (question.acceptedAnswerId) {
      await Answer.findByIdAndUpdate(question.acceptedAnswerId, { isAccepted: false });
    }

    answer.isAccepted = true;
    await answer.save();

    question.acceptedAnswerId = answer._id;
    question.status = 'answered';
    await question.save();

    res.json({
      success: true,
      data: answer
    });
  } catch (error) {
    logger.error('Error accepting answer:', error);
    next(error);
  }
};

export const voteAnswer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { answerId } = req.params;
    const userId = req.userId!;
    const { vote } = req.body;

    if (vote !== 1 && vote !== -1) {
      throw new BadRequestError('Vote must be 1 (upvote) or -1 (downvote)');
    }

    const answer = await Answer.findById(answerId);
    if (!answer) {
      throw new NotFoundError('Answer not found');
    }

    if (answer.authorId === userId) {
      throw new ForbiddenError('You cannot vote on your own answer');
    }

    const existingVoteIndex = answer.voters.findIndex(v => v.oderId === userId);

    if (existingVoteIndex !== -1) {
      const existingVote = answer.voters[existingVoteIndex].vote;

      if (existingVote === vote) {
        answer.voters.splice(existingVoteIndex, 1);
        if (vote === 1) {
          answer.upvotes -= 1;
        } else {
          answer.downvotes -= 1;
        }
      } else {
        answer.voters[existingVoteIndex].vote = vote;
        if (vote === 1) {
          answer.upvotes += 1;
          answer.downvotes -= 1;
        } else {
          answer.upvotes -= 1;
          answer.downvotes += 1;
        }
      }
    } else {
      answer.voters.push({ oderId: userId, vote });
      if (vote === 1) {
        answer.upvotes += 1;
      } else {
        answer.downvotes += 1;
      }
    }

    await answer.save();

    res.json({
      success: true,
      data: {
        upvotes: answer.upvotes,
        downvotes: answer.downvotes,
        score: answer.upvotes - answer.downvotes
      }
    });
  } catch (error) {
    logger.error('Error voting on answer:', error);
    next(error);
  }
};
