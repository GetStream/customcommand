const ticketFormMML = (description, reportedByDefault) => {
    return `
        <mml name="ticket_form">
            <text>creating ticket about "${description}"</text>
            <row>
                <column width="2">By:</column>
                <column width="10">
                    <input type="text" name="reported_by" value="${reportedByDefault}" />
                </column>
            </row>
            <button_list>
                <button name="action" value="confirm">Confirm</button>
                <button name="action" value="cancel">Cancel</button>      
            </button_list>
        </mml>`;
};

const confirmFormMML = (description, reportedBy) => {
    return `
        <mml>
            <text>ticket created about "${description}" by ${reportedBy}</text>
        </mml>`;
};

module.exports = (req, res) => {
    // the body of the message we will modify based on user interactions
    let message = req.body.message;

    // form_data will only be present once the user starts interacting
    const formData = req.body.form_data || {};
    const action = formData["action"];
    const user = req.body.user;

    console.log(`POST /${message.command} "${message.args}" => ${JSON.stringify(formData)}`);

    switch (action) {
        case "confirm":
            const reportedBy = formData["reported_by"];
            message.type = "regular";
            message.mml = confirmFormMML(message.args, reportedBy);
            message.attachments = null;
            break;
        case "cancel":
            message = null;
            break;
        default:
            if (message.args.trim() === "") {
                message.type = "error";
                message.text = "missing ticket description";
                message.mml = null;
                break;
            }
            message.type = "ephemeral";
            message.mml = ticketFormMML(message.args, user.name);
    }

    if (message.mml !== null) {
        message.text = "this message contains Message Markup Language, you might need to upgrade your stream-chat-react library.";
    }

    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({message}))
};