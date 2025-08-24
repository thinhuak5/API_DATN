// controllers/api/admin/categoryController.js
const categoryModel = require('../../../models/category');
const productModel = require('../../../models/product'); // cần để lấy sp theo cat
const { Op } = require('sequelize');

/**
 * ==========================
 * ADMIN ENDPOINTS
 * ==========================
 */

exports.getAll = async (req, res) => {
  try {
    const data = await categoryModel.findAll();
    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

exports.getAllParents = async (req, res) => {
  try {
    const data = await categoryModel.findAll({
      where: { parent_id: { [Op.is]: null } },
      order: [['name', 'ASC']],
    });
    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh mục cha' });
  }
};

exports.getByParent = async (req, res) => {
  try {
    const parentId = req.params.parent_id;
    const data = await categoryModel.findAll({
      where: { parent_id: parentId },
      order: [['name', 'ASC']],
    });
    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('Lỗi chi tiết getByParent:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh mục con theo danh mục cha' });
  }
};

exports.detail = async (req, res) => {
  try {
    const category = await categoryModel.findByPk(req.params.id);
    if (!category) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

exports.create = async (req, res) => {
  try {
    const body = req.body || {};
    const data = {
      name: body.name,
      status: normalize01(body.status),
      show_home: normalize01(body.show_home),
      parent_id: body.parent_id ?? null,
    };
    if (!data.name || typeof data.status === 'undefined') {
      return res.status(400).json({ error: 'Thiếu dữ liệu bắt buộc' });
    }
    if (req.file) data.images = req.file.path;

    const category = await categoryModel.create(data);
    res.json({ message: 'Danh mục đã được tạo thành công', category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

exports.update = async (req, res) => {
  try {
    const body = req.body || {};
    const data = {
      name: body.name,
      status: typeof body.status === 'undefined' ? undefined : normalize01(body.status),
      show_home: typeof body.show_home === 'undefined' ? undefined : normalize01(body.show_home),
      parent_id: body.parent_id ?? null,
    };

    if (data.parent_id && String(data.parent_id) === String(req.params.id)) {
      return res.status(400).json({ error: 'Không thể chọn chính nó làm danh mục cha!' });
    }
    if (req.file) data.images = req.file.path;

    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    const [updated] = await categoryModel.update(data, { where: { id: req.params.id } });
    if (updated === 0) return res.status(404).json({ error: 'Danh mục không tìm thấy' });

    res.json({ message: 'Cập nhật danh mục thành công' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

exports.delete = async (req, res) => {
  try {
    await categoryModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Danh mục đã được xóa thành công!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

/**
 * ==========================
 * PUBLIC ENDPOINTS (CHO FE)
 * ==========================
 */

exports.getAllPublic = async (req, res) => {
  try {
    const all = await categoryModel.findAll({ order: [['name', 'ASC']] });
    const arr = Array.isArray(all) ? all.map((r) => r.toJSON()) : [];

    const byId = new Map(arr.map((c) => [String(c.id), c]));
    const visible = arr.filter((c) => {
      if (Number(c.status) !== 1) return false;
      if (c.parent_id == null) return true;
      const parent = byId.get(String(c.parent_id));
      return parent && Number(parent.status) === 1;
    });

    res.json(visible);
  } catch (error) {
    console.error('getAllPublic error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

exports.getAllParentsPublic = async (req, res) => {
  try {
    const data = await categoryModel.findAll({
      where: { parent_id: { [Op.is]: null }, status: 1 },
      order: [['name', 'ASC']],
    });
    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh mục cha (public)' });
  }
};

exports.getByParentPublic = async (req, res) => {
  try {
    const parentId = req.params.parent_id;
    const parent = await categoryModel.findOne({ where: { id: parentId, status: 1 } });
    if (!parent) return res.json([]);

    const data = await categoryModel.findAll({
      where: { parent_id: parentId, status: 1 },
      order: [['name', 'ASC']],
    });
    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('getByParentPublic error:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh mục con (public)' });
  }
};

exports.detailPublic = async (req, res) => {
  try {
    const id = req.params.id;
    const cat = await categoryModel.findByPk(id);
    if (!cat || Number(cat.status) !== 1) {
      return res.status(404).json({ error: 'Không tìm thấy danh mục' });
    }
    if (cat.parent_id != null) {
      const parent = await categoryModel.findOne({ where: { id: cat.parent_id, status: 1 } });
      if (!parent) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
    }
    return res.json(cat);
  } catch (error) {
    console.error('detailPublic error:', error);
    return res.status(500).json({ error: 'Lỗi server' });
  }
};

/**
 * PUBLIC: Trả các "section" cho trang HOME
 * - Lấy danh mục CHA có show_home=1 và status=1
 * - Gộp sản phẩm của chính CHA + mọi CON (status=1), sort mới nhất, mặc định lấy 6 sản phẩm/section
 */
exports.getHomeSections = async (req, res) => {
  try {
    const limitPerSection = Number(req.query.limit) || 6;

    // 1) CHA hiển thị ở Home
    const parents = await categoryModel.findAll({
      where: { parent_id: null, status: 1, show_home: 1 },
      order: [['name', 'ASC']],
    });
    if (!parents.length) return res.json([]);

    const parentIds = parents.map((p) => p.id);

    // 2) CON (status=1) của các CHA
    const children = await categoryModel.findAll({
      attributes: ['id', 'name', 'parent_id'],
      where: { status: 1, parent_id: { [Op.in]: parentIds } },
    });

    const childrenByParent = new Map(parentIds.map((id) => [String(id), []]));
    const parentOfChild = new Map(); // childId -> parentId
    for (const c of children) {
      const pid = String(c.parent_id);
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid).push(c.toJSON());
      parentOfChild.set(String(c.id), pid);
    }

    // 3) Chuẩn hoá động theo productModel (tránh lỗi tên cột / alias)
    const attrs = productModel?.rawAttributes || {};
    const hasAttr = (k) => !!attrs[k];

    // Field danh mục trên product
    const catAttr =
      (hasAttr('category_id') && 'category_id') ||
      (hasAttr('categoryId') && 'categoryId') ||
      null;

    // Field status nếu có
    const statusAttr = hasAttr('status') ? 'status' : null;

    // Tập category cần lấy
    const allCatIds = [...parentIds, ...children.map((c) => c.id)];

    // Biểu thức sắp xếp an toàn
    const orderExpr = hasAttr('createdAt')
      ? [['createdAt', 'DESC']]
      : hasAttr('created_at')
      ? [['created_at', 'DESC']]
      : [['id', 'DESC']];

    // 4) Include động: chỉ include association có thật
    const include = [];
    const assoc = productModel.associations || {};

    // a) Ảnh trực tiếp của product
    if (assoc.productImages) {
      include.push({
        association: assoc.productImages,
        attributes: ['id', 'image_url'],
        separate: true,
        limit: 1,
        order: [['id', 'ASC']],
      });
    } else if (assoc.images) {
      include.push({
        association: assoc.images,
        attributes: ['id', 'image_url'],
        separate: true,
        limit: 1,
        order: [['id', 'ASC']],
      });
    }

    // b) variations + ảnh của variation
    if (assoc.variations) {
      const varTarget = assoc.variations.target;
      const varInclude = {
        association: assoc.variations,
        attributes: ['id', 'price'],
        include: [],
      };
      if (varTarget?.associations?.productImages) {
        varInclude.include.push({
          association: varTarget.associations.productImages,
          attributes: ['id', 'image_url'],
          separate: true,
          limit: 1,
          order: [['id', 'ASC']],
        });
      } else if (varTarget?.associations?.images) {
        varInclude.include.push({
          association: varTarget.associations.images,
          attributes: ['id', 'image_url'],
          separate: true,
          limit: 1,
          order: [['id', 'ASC']],
        });
      }
      include.push(varInclude);
    }

    // c) Category (belongsTo) – dùng khi không có catAttr để lọc/group
    const categoryAssoc =
      assoc.category || assoc.Category || assoc.categories || assoc.Categories;
    if (categoryAssoc) {
      include.push({
        association: categoryAssoc,
        attributes: ['id', 'parent_id'],
        required: !!(!catAttr), // nếu không có catAttr thì required = true để lọc theo include
        where: !catAttr ? { id: { [Op.in]: allCatIds } } : undefined,
      });
    }

    // 5) where an toàn
    const where = {};
    if (statusAttr) where[statusAttr] = 1;
    if (catAttr) where[catAttr] = { [Op.in]: allCatIds };

    // 6) Lấy sản phẩm
    const allProducts = await productModel.findAll({
      where: Object.keys(where).length ? where : undefined,
      attributes: [
        hasAttr('id') ? 'id' : undefined,
        hasAttr('name') ? 'name' : undefined,
        hasAttr('price') ? 'price' : undefined,
        catAttr || undefined,
        hasAttr('createdAt') ? 'createdAt' : undefined,
        hasAttr('created_at') ? 'created_at' : undefined,
      ].filter(Boolean),
      include,
      order: orderExpr,
    });

    // 7) Group sản phẩm theo CHA
    const productsByParent = new Map(parentIds.map((id) => [String(id), []]));
    for (const p of allProducts) {
      // Lấy catId từ field hoặc association
      let cid =
        (catAttr && p.get(catAttr)) ||
        (p.category && p.category.id) ||
        (p.Category && p.Category.id) ||
        null;

      if (cid == null) continue;
      cid = String(cid);

      const pid = parentIds.includes(Number(cid)) ? cid : parentOfChild.get(cid);
      if (pid && productsByParent.has(pid)) {
        productsByParent.get(pid).push(p.toJSON());
      }
    }

    // 8) Build sections
    const sections = parents.map((p) => {
      const pid = String(p.id);
      const prods = (productsByParent.get(pid) || []).slice(0, limitPerSection);
      const childs = (childrenByParent.get(pid) || []).map((c) => ({ id: c.id, name: c.name }));
      return {
        id: p.id,
        name: p.name,
        images: p.images,
        children: childs,
        products: prods,
      };
    });

    return res.json(sections);
  } catch (error) {
    console.error(
      'getHomeSections error:',
      error?.name,
      error?.message,
      error?.original?.sqlMessage || ''
    );
    return res.status(500).json({ error: 'Lỗi server ở /public/home/sections' });
  }
};

/** Helper: chuẩn hóa 0/1 */
function normalize01(s) {
  if (s === true || s === 'true' || s === 'Hiển thị' || s === 'Có' || s === '1') return 1;
  if (s === false || s === 'false' || s === 'Ẩn' || s === 'Không' || s === '0') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? (n ? 1 : 0) : 0;
}
