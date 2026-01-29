import { Response, NextFunction } from 'express';
import { AuthRequest } from '@cloudmastershub/middleware';
import { Group, GroupMember, Post } from '../models';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export const getGroups = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    const category = req.query.category as string;
    const search = req.query.search as string;

    let query: any = {
      isActive: true,
      privacy: { $in: ['public', 'private'] }
    };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const [groups, total] = await Promise.all([
      Group.find(query)
        .sort({ memberCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Group.countDocuments(query)
    ]);

    let groupsWithMembership = groups;
    if (userId) {
      const groupIds = groups.map(g => g._id);
      const memberships = await GroupMember.find({
        groupId: { $in: groupIds },
        userId,
        status: { $in: ['active', 'pending'] }
      });
      const membershipMap = new Map(memberships.map(m => [m.groupId.toString(), m]));

      groupsWithMembership = groups.map(group => ({
        ...group.toJSON(),
        membership: membershipMap.get(group._id.toString()) || null
      })) as any;
    }

    res.json({
      success: true,
      data: {
        groups: groupsWithMembership,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching groups:', error);
    next(error);
  }
};

export const getGroupById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const group = await Group.findById(id);
    if (!group || !group.isActive) {
      throw new NotFoundError('Group not found');
    }

    if (group.privacy === 'hidden') {
      const membership = await GroupMember.findOne({
        groupId: id,
        userId,
        status: 'active'
      });
      if (!membership) {
        throw new NotFoundError('Group not found');
      }
    }

    let membership = null;
    if (userId) {
      membership = await GroupMember.findOne({
        groupId: id,
        userId,
        status: { $in: ['active', 'pending'] }
      });
    }

    res.json({
      success: true,
      data: {
        ...group.toJSON(),
        membership
      }
    });
  } catch (error) {
    logger.error('Error fetching group:', error);
    next(error);
  }
};

export const createGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, description, category, privacy, coverImage, icon, tags, rules, maxMembers, courseId } = req.body;

    if (!name || !description) {
      throw new BadRequestError('Name and description are required');
    }

    const slug = `${generateSlug(name)}-${Date.now().toString(36)}`;

    const group = new Group({
      name,
      slug,
      description,
      category: category || 'study',
      privacy: privacy || 'public',
      coverImage,
      icon,
      ownerId: userId,
      ownerName: req.user?.email?.split('@')[0] || 'User',
      admins: [userId],
      tags: tags || [],
      rules: rules || [],
      maxMembers: maxMembers || 500,
      courseId,
      memberCount: 1
    });

    await group.save();

    const membership = new GroupMember({
      groupId: group._id,
      userId,
      userName: req.user?.email?.split('@')[0] || 'User',
      role: 'owner',
      status: 'active'
    });
    await membership.save();

    logger.info(`Group created: ${group.name} by ${userId}`);

    res.status(201).json({
      success: true,
      data: group
    });
  } catch (error) {
    logger.error('Error creating group:', error);
    next(error);
  }
};

export const updateGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const group = await Group.findById(id);
    if (!group || !group.isActive) {
      throw new NotFoundError('Group not found');
    }

    if (group.ownerId !== userId && !group.admins.includes(userId)) {
      throw new ForbiddenError('Only group owners and admins can update the group');
    }

    const { name, description, category, privacy, coverImage, icon, tags, rules, maxMembers } = req.body;

    if (name !== undefined) {
      group.name = name;
      group.slug = `${generateSlug(name)}-${Date.now().toString(36)}`;
    }
    if (description !== undefined) group.description = description;
    if (category !== undefined) group.category = category;
    if (privacy !== undefined) group.privacy = privacy;
    if (coverImage !== undefined) group.coverImage = coverImage;
    if (icon !== undefined) group.icon = icon;
    if (tags !== undefined) group.tags = tags;
    if (rules !== undefined) group.rules = rules;
    if (maxMembers !== undefined) group.maxMembers = maxMembers;

    await group.save();

    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    logger.error('Error updating group:', error);
    next(error);
  }
};

export const deleteGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const group = await Group.findById(id);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    if (group.ownerId !== userId) {
      throw new ForbiddenError('Only the group owner can delete the group');
    }

    group.isActive = false;
    await group.save();

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting group:', error);
    next(error);
  }
};

export const joinGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const group = await Group.findById(id);
    if (!group || !group.isActive) {
      throw new NotFoundError('Group not found');
    }

    if (group.privacy === 'hidden') {
      throw new ForbiddenError('This group is invite-only');
    }

    const existingMember = await GroupMember.findOne({ groupId: id, userId });
    if (existingMember) {
      if (existingMember.status === 'active') {
        throw new ConflictError('You are already a member of this group');
      }
      if (existingMember.status === 'banned') {
        throw new ForbiddenError('You have been banned from this group');
      }
      if (existingMember.status === 'pending') {
        throw new ConflictError('Your join request is pending approval');
      }
    }

    if (group.memberCount >= group.maxMembers) {
      throw new BadRequestError('This group has reached its maximum capacity');
    }

    const status = group.privacy === 'private' ? 'pending' : 'active';

    const membership = new GroupMember({
      groupId: id,
      userId,
      userName: req.user?.email?.split('@')[0] || 'User',
      role: 'member',
      status
    });
    await membership.save();

    if (status === 'active') {
      await Group.findByIdAndUpdate(id, {
        $inc: { memberCount: 1 },
        lastActivity: new Date()
      });
    }

    res.status(201).json({
      success: true,
      data: membership,
      message: status === 'pending' ? 'Join request submitted' : 'Successfully joined the group'
    });
  } catch (error) {
    logger.error('Error joining group:', error);
    next(error);
  }
};

export const leaveGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const group = await Group.findById(id);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    if (group.ownerId === userId) {
      throw new BadRequestError('Group owner cannot leave. Transfer ownership or delete the group.');
    }

    const membership = await GroupMember.findOne({
      groupId: id,
      userId,
      status: 'active'
    });

    if (!membership) {
      throw new NotFoundError('You are not a member of this group');
    }

    membership.status = 'left';
    await membership.save();

    await Group.findByIdAndUpdate(id, { $inc: { memberCount: -1 } });

    if (group.admins.includes(userId)) {
      await Group.findByIdAndUpdate(id, { $pull: { admins: userId } });
    }

    res.json({
      success: true,
      message: 'Successfully left the group'
    });
  } catch (error) {
    logger.error('Error leaving group:', error);
    next(error);
  }
};

export const getGroupMembers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    const role = req.query.role as string;
    const status = (req.query.status as string) || 'active';

    const group = await Group.findById(id);
    if (!group || !group.isActive) {
      throw new NotFoundError('Group not found');
    }

    let query: any = { groupId: id, status };
    if (role) {
      query.role = role;
    }

    const [members, total] = await Promise.all([
      GroupMember.find(query)
        .sort({ role: 1, joinedAt: 1 })
        .skip(skip)
        .limit(limit),
      GroupMember.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        members,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching group members:', error);
    next(error);
  }
};

export const updateMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, memberId } = req.params;
    const userId = req.userId!;
    const { role, status, banReason } = req.body;

    const group = await Group.findById(id);
    if (!group || !group.isActive) {
      throw new NotFoundError('Group not found');
    }

    if (group.ownerId !== userId && !group.admins.includes(userId)) {
      throw new ForbiddenError('Only group owners and admins can manage members');
    }

    const membership = await GroupMember.findById(memberId);
    if (!membership || membership.groupId.toString() !== id) {
      throw new NotFoundError('Member not found');
    }

    if (membership.role === 'owner') {
      throw new ForbiddenError('Cannot modify the group owner');
    }

    const wasActive = membership.status === 'active';

    if (role !== undefined && role !== 'owner') {
      membership.role = role;

      if (role === 'admin' && !group.admins.includes(membership.userId)) {
        await Group.findByIdAndUpdate(id, { $push: { admins: membership.userId } });
      } else if (role !== 'admin' && group.admins.includes(membership.userId)) {
        await Group.findByIdAndUpdate(id, { $pull: { admins: membership.userId } });
      }
    }

    if (status !== undefined) {
      membership.status = status;
      if (status === 'banned') {
        membership.bannedAt = new Date();
        membership.bannedBy = userId;
        membership.banReason = banReason;
      }

      if (wasActive && status !== 'active') {
        await Group.findByIdAndUpdate(id, { $inc: { memberCount: -1 } });
      } else if (!wasActive && status === 'active') {
        await Group.findByIdAndUpdate(id, { $inc: { memberCount: 1 } });
      }
    }

    await membership.save();

    res.json({
      success: true,
      data: membership
    });
  } catch (error) {
    logger.error('Error updating member:', error);
    next(error);
  }
};

export const getGroupPosts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const group = await Group.findById(id);
    if (!group || !group.isActive) {
      throw new NotFoundError('Group not found');
    }

    if (group.privacy !== 'public') {
      const membership = await GroupMember.findOne({
        groupId: id,
        userId,
        status: 'active'
      });
      if (!membership) {
        throw new ForbiddenError('You must be a member to view group posts');
      }
    }

    const [posts, total] = await Promise.all([
      Post.find({ groupId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({ groupId: id })
    ]);

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching group posts:', error);
    next(error);
  }
};

export const getUserGroups = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [memberships, total] = await Promise.all([
      GroupMember.find({ userId, status: 'active' })
        .sort({ joinedAt: -1 })
        .skip(skip)
        .limit(limit),
      GroupMember.countDocuments({ userId, status: 'active' })
    ]);

    const groupIds = memberships.map(m => m.groupId);
    const groups = await Group.find({ _id: { $in: groupIds }, isActive: true });

    const groupsWithRole = groups.map(group => {
      const membership = memberships.find(m => m.groupId.toString() === group._id.toString());
      return {
        ...group.toJSON(),
        role: membership?.role
      };
    });

    res.json({
      success: true,
      data: {
        groups: groupsWithRole,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching user groups:', error);
    next(error);
  }
};
