const { EmbedBuilder } = require('discord.js');
const { addBirthdayToDB, getAllBirthdaysFromDB, removeBirthdayFromDB } = require('../utils/birthdays');

module.exports = async function birthdayCommand(interaction, client) {
  let sub;
  try { sub = interaction.options.getSubcommand(); } catch (e) { sub = null; }

  if (sub === 'add') {
    await handleAdd(interaction, client);
  } else if (sub === 'list') {
    await handleList(interaction, client);
  } else if (sub === 'remove') {
    await handleRemove(interaction, client);
  }
};

async function handleAdd(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const birthdayStr = interaction.options.getString('date');

    // Parse the date input (MM-DD, MM/DD, or MM-DD-YYYY format)
    const parsed = parseBirthdayInput(birthdayStr);
    if (!parsed) {
      return interaction.editReply(
        '❌ Invalid date format. Please use MM-DD, MM/DD, or MM-DD-YYYY format (e.g., 12-25 for December 25th).'
      );
    }

    // Add to database
    const success = await addBirthdayToDB(userId, username, parsed);
    if (!success) {
      return interaction.editReply('❌ Failed to add birthday to database. Please try again later.');
    }

    const displayDate = formatBirthdayDisplay(parsed);
    return interaction.editReply(`✅ Birthday saved! Your birthday is set to ${displayDate}.`);
  } catch (err) {
    console.error('[birthday add] Error:', err && err.message ? err.message : err);
    return interaction.editReply('❌ An error occurred while saving your birthday.');
  }
}

async function handleList(interaction, client) {
  try {
    await interaction.deferReply();

    const birthdays = await getAllBirthdaysFromDB();
    if (!birthdays || birthdays.length === 0) {
      return interaction.editReply('📅 No birthdays registered yet.');
    }

    // Sort by month then day
    birthdays.sort((a, b) => {
      const aDate = new Date(`2000-${a.monthDay}`);
      const bDate = new Date(`2000-${b.monthDay}`);
      return aDate - bDate;
    });

    // Format the list
    const lines = birthdays.map(bd => {
      const display = formatBirthdayDisplay(bd.monthDay);
      const mention = /^\d{15,25}$/.test(String(bd.userId || '')) ? `<@${bd.userId}>` : (bd.name || bd.userId);
      return `• ${mention} - ${display}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🎂 Birthday Calendar')
      .setDescription(lines.join('\n'))
      .setColor(0xffd700);

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[birthday list] Error:', err && err.message ? err.message : err);
    return interaction.editReply('❌ An error occurred while fetching birthdays.');
  }
}

async function handleRemove(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Check permission
    const caller = interaction.member;
    if (!caller.permissions.has('ManageGuild')) {
      return interaction.editReply('❌ You do not have permission to remove birthdays. (Requires Manage Guild)');
    }

    const targetUser = interaction.options.getUser('user');
    if (!targetUser) {
      return interaction.editReply('❌ Please specify a user to remove.');
    }

    const success = await removeBirthdayFromDB(targetUser.id);
    if (!success) {
      return interaction.editReply(`❌ No birthday found for <@${targetUser.id}>.`);
    }

    return interaction.editReply(`✅ Birthday removed for <@${targetUser.id}>.`);
  } catch (err) {
    console.error('[birthday remove] Error:', err && err.message ? err.message : err);
    return interaction.editReply('❌ An error occurred while removing the birthday.');
  }
}

function parseBirthdayInput(input) {
  if (!input) return null;
  const s = input.trim();
  
  // Try MM-DD or MM/DD format
  let m = s.match(/^(\d{1,2})[-\/](\d{1,2})$/);
  if (m) {
    const month = String(m[1]).padStart(2, '0');
    const day = String(m[2]).padStart(2, '0');
    // Basic validation
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
      return null;
    }
    return `${month}-${day}`;
  }

  // Try YYYY-MM-DD or MM-DD-YYYY format
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    let month, day;
    if (m[1]) {
      // YYYY-MM-DD format
      month = String(m[2]).padStart(2, '0');
      day = String(m[3]).padStart(2, '0');
    } else {
      // MM-DD-YYYY format
      month = String(m[4]).padStart(2, '0');
      day = String(m[5]).padStart(2, '0');
    }
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
      return null;
    }
    return `${month}-${day}`;
  }

  return null;
}

function formatBirthdayDisplay(monthDay) {
  if (!monthDay) return 'Unknown';
  const parts = monthDay.split('-');
  if (parts.length !== 2) return monthDay;
  
  const month = Number(parts[0]);
  const day = Number(parts[1]);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[month - 1] || 'Unknown';
  
  return `${monthName} ${day}`;
}
