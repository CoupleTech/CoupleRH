/**
 * timesheetPdfService.ts
 * 
 * Serviço de geração e emissão do Espelho de Ponto Eletrônico
 * em estrita conformidade com a Portaria MTP nº 671/2021 (Art. 84):
 * 
 * Elementos obrigatórios:
 * - Identificação do empregador (Razão Social, CNPJ, Endereço).
 * - Identificação do empregado (Nome, CPF, CTPS/Matrícula, Cargo, Departamento, Data de Admissão).
 * - Período de apuração da folha de ponto.
 * - Horários contratuais e jornada de trabalho pactuada.
 * - Grade diária com todas as marcações originais realizadas, marcações tratadas e justificativas.
 * - Totalizadores mensais (horas normais, extras 50%/100%, adicional noturno, atrasos, faltas, intrajornada).
 * - Saldo e movimentação do Banco de Horas no período.
 * - Hash criptográfico SHA-256 de integridade documental (H1).
 * - Campos para manifestação de ciência e assinatura do empregado e do empregador.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sha256Sync } from '../../utils/sha256';

export interface TimesheetDailyRow {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // Seg, Ter, Qua...
  scheduled_in?: string;
  scheduled_break_start?: string;
  scheduled_break_end?: string;
  scheduled_out?: string;
  punches: string[]; // ['08:00', '12:00', '13:00', '17:00']
  treated_punches?: string[];
  worked_minutes: number;
  overtime_50_minutes: number;
  overtime_100_minutes: number;
  night_shift_minutes: number;
  delay_minutes: number;
  absence_minutes: number;
  intrajornada_violation_minutes: number;
  time_bank_minutes: number;
  status: string; // REGULAR, INCONSISTENT, DAY_OFF, HOLIDAY, VACATION...
  notes?: string;
}

export interface TimesheetCompanyInfo {
  corporate_name: string;
  cnpj: string;
  address?: string;
}

export interface TimesheetEmployeeInfo {
  worker_id: string;
  full_name: string;
  cpf: string;
  registration_number?: string;
  position?: string;
  department?: string;
  admission_date?: string;
}

export interface TimesheetPeriodInfo {
  month: number;
  year: number;
  start_date: string;
  end_date: string;
}

export interface TimesheetTimeBankSummary {
  previous_balance_minutes: number;
  credits_minutes: number;
  debits_minutes: number;
  current_balance_minutes: number;
}

export interface TimesheetReportData {
  tenant_id: string;
  company: TimesheetCompanyInfo;
  employee: TimesheetEmployeeInfo;
  period: TimesheetPeriodInfo;
  standard_schedule_description?: string;
  daily_rows: TimesheetDailyRow[];
  time_bank_summary?: TimesheetTimeBankSummary;
}

export interface TimesheetMonthlyTotals {
  total_worked_minutes: number;
  total_worked_formatted: string;
  total_overtime_50_minutes: number;
  total_overtime_50_formatted: string;
  total_overtime_100_minutes: number;
  total_overtime_100_formatted: string;
  total_night_shift_minutes: number;
  total_night_shift_formatted: string;
  total_delay_minutes: number;
  total_delay_formatted: string;
  total_absence_minutes: number;
  total_absence_formatted: string;
  total_intrajornada_violation_minutes: number;
  total_intrajornada_violation_formatted: string;
  total_time_bank_movement_minutes: number;
  total_time_bank_movement_formatted: string;
}

export function formatMinutesHHMM(minutes: number, withSign: boolean = false): string {
  if (minutes === 0) return '00:00';
  const sign = minutes > 0 ? (withSign ? '+' : '') : '-';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export class TimesheetPdfService {
  /**
   * 1. Consolida os totalizadores mensais da grade de dias.
   */
  public static calculateMonthlyTotals(dailyRows: TimesheetDailyRow[]): TimesheetMonthlyTotals {
    let worked = 0;
    let he50 = 0;
    let he100 = 0;
    let night = 0;
    let delay = 0;
    let absence = 0;
    let intra = 0;
    let tbMovement = 0;

    for (const row of dailyRows) {
      worked += row.worked_minutes || 0;
      he50 += row.overtime_50_minutes || 0;
      he100 += row.overtime_100_minutes || 0;
      night += row.night_shift_minutes || 0;
      delay += row.delay_minutes || 0;
      absence += row.absence_minutes || 0;
      intra += row.intrajornada_violation_minutes || 0;
      tbMovement += row.time_bank_minutes || 0;
    }

    return {
      total_worked_minutes: worked,
      total_worked_formatted: formatMinutesHHMM(worked),
      total_overtime_50_minutes: he50,
      total_overtime_50_formatted: formatMinutesHHMM(he50),
      total_overtime_100_minutes: he100,
      total_overtime_100_formatted: formatMinutesHHMM(he100),
      total_night_shift_minutes: night,
      total_night_shift_formatted: formatMinutesHHMM(night),
      total_delay_minutes: delay,
      total_delay_formatted: formatMinutesHHMM(delay),
      total_absence_minutes: absence,
      total_absence_formatted: formatMinutesHHMM(absence),
      total_intrajornada_violation_minutes: intra,
      total_intrajornada_violation_formatted: formatMinutesHHMM(intra),
      total_time_bank_movement_minutes: tbMovement,
      total_time_bank_movement_formatted: formatMinutesHHMM(tbMovement, true)
    };
  }

  /**
   * 2. Calcula hash SHA-256 canônico dos dados do espelho de ponto para garantia de integridade.
   */
  public static computeDocumentHash(data: TimesheetReportData): string {
    const payload = {
      tenant_id: data.tenant_id,
      company_cnpj: data.company.cnpj,
      employee_cpf: data.employee.cpf,
      period_start: data.period.start_date,
      period_end: data.period.end_date,
      rows: data.daily_rows.map((r) => ({
        d: r.date,
        p: r.punches,
        tp: r.treated_punches,
        w: r.worked_minutes,
        he50: r.overtime_50_minutes,
        he100: r.overtime_100_minutes,
        n: r.night_shift_minutes,
        dl: r.delay_minutes,
        ab: r.absence_minutes,
        s: r.status
      })),
      tb: data.time_bank_summary
    };

    const json = JSON.stringify(payload, Object.keys(payload).sort());
    return sha256Sync(json);
  }

  /**
   * 3. Gera documento PDF do Espelho de Ponto Eletrônico (Portaria MTP 671/2021).
   */
  public static generateTimesheetPdf(data: TimesheetReportData): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const totals = this.calculateMonthlyTotals(data.daily_rows);
    const documentHash = this.computeDocumentHash(data);

    // ── Cabeçalho do Empregador e Portaria 671 ──
    doc.setFillColor(243, 244, 246);
    doc.rect(10, 8, 190, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('ESPELHO DE PONTO ELETRÔNICO', 105, 14, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Em conformidade com o Art. 84 da Portaria MTP nº 671/2021', 105, 18, { align: 'center' });
    doc.setFontSize(7);
    doc.text(`Hash de Integridade (SHA-256): ${documentHash.substring(0, 32)}...`, 105, 22, { align: 'center' });

    // ── Dados do Empregador ──
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPREGADOR:', 10, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.company.corporate_name}  —  CNPJ: ${data.company.cnpj}`, 36, 34);

    if (data.company.address) {
      doc.setFont('helvetica', 'bold');
      doc.text('ENDEREÇO:', 10, 38);
      doc.setFont('helvetica', 'normal');
      doc.text(data.company.address, 36, 38);
    }

    // ── Dados do Empregado ──
    doc.setFont('helvetica', 'bold');
    doc.text('EMPREGADO:', 10, 43);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${data.employee.full_name}  |  CPF: ${data.employee.cpf}  |  Matrícula: ${data.employee.registration_number || 'N/A'}`,
      36,
      43
    );

    doc.setFont('helvetica', 'bold');
    doc.text('CARGO / DEPTO:', 10, 47);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${data.employee.position || 'N/D'}  /  ${data.employee.department || 'Geral'}  |  Admissão: ${data.employee.admission_date || 'N/D'}`,
      36,
      47
    );

    doc.setFont('helvetica', 'bold');
    doc.text('PERÍODO:', 10, 51);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${data.period.start_date} a ${data.period.end_date} (Comp. ${String(data.period.month).padStart(2, '0')}/${data.period.year})`,
      36,
      51
    );

    if (data.standard_schedule_description) {
      doc.setFont('helvetica', 'bold');
      doc.text('HORÁRIO:', 10, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(data.standard_schedule_description, 36, 55);
    }

    // ── Tabela Diária de Marcações ──
    const tableHeaders = [
      ['Data', 'Dia', 'Batidas Registradas', 'Tratadas', 'Trabalho', 'HE 50%', 'HE 100%', 'Noturno', 'Atraso', 'B. Horas', 'Obs']
    ];

    const tableRows = data.daily_rows.map((r) => [
      r.date.substring(5), // MM-DD
      r.dayOfWeek,
      r.punches && r.punches.length > 0 ? r.punches.join(' ') : '—',
      r.treated_punches && r.treated_punches.length > 0 ? r.treated_punches.join(' ') : '—',
      formatMinutesHHMM(r.worked_minutes),
      r.overtime_50_minutes > 0 ? formatMinutesHHMM(r.overtime_50_minutes) : '—',
      r.overtime_100_minutes > 0 ? formatMinutesHHMM(r.overtime_100_minutes) : '—',
      r.night_shift_minutes > 0 ? formatMinutesHHMM(r.night_shift_minutes) : '—',
      r.delay_minutes > 0 ? formatMinutesHHMM(r.delay_minutes) : '—',
      r.time_bank_minutes !== 0 ? formatMinutesHHMM(r.time_bank_minutes, true) : '—',
      r.notes || (r.status === 'DAY_OFF' ? 'DSR' : r.status === 'HOLIDAY' ? 'Feriado' : '')
    ]);

    autoTable(doc, {
      startY: 59,
      head: tableHeaders,
      body: tableRows,
      theme: 'grid',
      tableWidth: 190,
      styles: {
        fontSize: 6,
        cellPadding: 0.8,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [31, 41, 55],
        textColor: 255,
        fontSize: 6,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 13 },
        1: { halign: 'center', cellWidth: 9 },
        2: { halign: 'center', cellWidth: 32 },
        3: { halign: 'center', cellWidth: 26 },
        4: { halign: 'center', cellWidth: 14 },
        5: { halign: 'center', cellWidth: 13 },
        6: { halign: 'center', cellWidth: 13 },
        7: { halign: 'center', cellWidth: 13 },
        8: { halign: 'center', cellWidth: 12 },
        9: { halign: 'center', cellWidth: 15 },
        10: { halign: 'left', cellWidth: 30 }
      },
      margin: { left: 10, right: 10 }
    });

    // Posição final após a tabela
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 4 : 220;

    // ── Resumo de Totais e Banco de Horas ──
    const remainingSpace = 297 - finalY;
    let summaryY = finalY;
    if (remainingSpace < 45) {
      doc.addPage();
      summaryY = 15;
    }

    doc.setFillColor(243, 244, 246);
    doc.rect(10, summaryY, 190, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('TOTALIZADORES DO PERÍODO:', 12, summaryY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      `Horas Trabalhadas: ${totals.total_worked_formatted}  |  HE 50%: ${totals.total_overtime_50_formatted}  |  HE 100%: ${totals.total_overtime_100_formatted}  |  Noturno: ${totals.total_night_shift_formatted}`,
      12,
      summaryY + 8
    );
    doc.text(
      `Atrasos: ${totals.total_delay_formatted}  |  Faltas: ${totals.total_absence_formatted}  |  Intrajornada Suprimida: ${totals.total_intrajornada_violation_formatted}`,
      12,
      summaryY + 12
    );

    if (data.time_bank_summary) {
      doc.text(
        `Banco de Horas — Saldo Anterior: ${formatMinutesHHMM(
          data.time_bank_summary.previous_balance_minutes,
          true
        )} | Créditos: ${formatMinutesHHMM(data.time_bank_summary.credits_minutes)} | Débitos: ${formatMinutesHHMM(
          data.time_bank_summary.debits_minutes
        )} | Saldo Atual: ${formatMinutesHHMM(data.time_bank_summary.current_balance_minutes, true)}`,
        12,
        summaryY + 16
      );
    }

    // ── Termo de Ciência e Campos de Assinatura ──
    const sigY = summaryY + 28;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Reconheço a exatidão das marcações de frequência e horários de trabalho acima discriminados, em cumprimento ao Art. 84 da Portaria MTP nº 671/2021.',
      10,
      sigY - 4
    );

    doc.line(20, sigY + 10, 85, sigY + 10);
    doc.setFont('helvetica', 'normal');
    doc.text('Assinatura do Empregador / Responsável DP', 52, sigY + 13, { align: 'center' });

    doc.line(125, sigY + 10, 190, sigY + 10);
    doc.text('Assinatura do Empregado', 157, sigY + 13, { align: 'center' });

    doc.setFontSize(6);
    doc.text(`Documento emitido eletronicamente em ${new Date().toLocaleString('pt-BR')}`, 105, sigY + 18, {
      align: 'center'
    });

    return doc;
  }
}
