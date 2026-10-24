import 'dart:typed_data';

import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';

class PersonTemplateService {
  static Future<void> download() async {
    final excel = Excel.createExcel();
    final sheet = excel.sheets[excel.getDefaultSheet()]!;
    sheet.appendRow([
      TextCellValue('姓名'),
      TextCellValue('部门'),
      TextCellValue('备注'),
    ]);
    sheet.appendRow([
      TextCellValue('张三'),
      TextCellValue('技术部'),
      TextCellValue('示例行，可删除'),
    ]);
    sheet.appendRow([
      TextCellValue('李四'),
      TextCellValue('行政部'),
      TextCellValue(''),
    ]);
    final bytes = Uint8List.fromList(excel.encode()!);
    await FilePicker.platform.saveFile(
      dialogTitle: '保存导入模板',
      fileName: '人员导入模板.xlsx',
      type: FileType.custom,
      allowedExtensions: ['xlsx'],
      bytes: bytes,
    );
  }
}
