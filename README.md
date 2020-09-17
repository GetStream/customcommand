# Custom Command Handler Example using Express.js
## Custom commands and action handlers
### Simple custom slash command
In this example, we implement a custom slash command that can be used to create support tickets.    

#### Setup
##### Application Settings
First we set the custom_command_url in the application settings:

```javascript
await client.updateAppSettings({
    custom_command_url: "https://example.com/{type}",
});
```

You can use a `{type}` variable substitution in the URL to pass on the name of the command that was triggered.

#####  Create Custom Command
Next, we register a “ticket” custom command and provide a description of the command and its arguments.

```javascript
await client.createCommand({
    name: "ticket",
    description: "Create customer support tickets",
    args: "[description]",
});
```

#####  Create Channel Type
In order to be able to use this command in a channel, we’ll need to create a channel type that includes the ticket command.

```javascript
await client.createChannelType({
    name: "support-channel-type",
    commands: ["ticket"],
});
```

#####  Create Channel
We can now create a new channel that will support our using new ticket command.

```javascript
const channel = client.channel("support-channel-type", "support-chat", {
    name: "Support Chat",
});
await channel.create();
```

When we look at the channel’s config, we should see the ticket command listed there:

```javascript
console.log(channel.getConfig());
{
  name: 'support-channel',
  commands: [
    {
      app_pk: 12345,
      name: 'ticket',
      description: 'Create customer support tickets',
      args: '[description]',
    }
  ],
  ...
}
```

In the frontend this will make the ticket command show up in the command auto-completion popup.

####  Custom Command Handler
Now we’re ready to use our custom ticket command. 

```javascript
channel.sendMessage(text: "/ticket my laptop stopped working");
```

This will try to send a POST request to our custom_command_url endpoint with a JSON encoded body like:

```json
{
  "message": {
    "id": "gmoree-2b1909be-8b96-42c5-9c5b-01f84ea23330",
    "text": "/ticket my laptop stopped working",
    "command": "ticket",
    "args": "my laptop stopped working"
    "type": "regular",
    "attachments": [],
    ...
  },
  "user": {
    "id": "gmoree",
    "role": "user",
    "name": "Guyon Moree",
    ...
  }
}
```

##### Rewrite Message
To handle this request we’ll use Express JS. We’ll start by simply rewriting the message text to return the argument that was passed onto the ticket command:

```json
ticketCmdHandler = (req, res) => {
    // the body of the message we will modify 
    // based on user interactions
    let message = req.body.message;

    message.text = `ticket created about "${message.args}"`;

    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({message}))
};
```

This rewrites the message text and will be reflected in the frontend.

##### Actions
In order to add some interactivity to our command, we’ll be using message attachment actions, to let the user confirm or cancel the support ticket request. 

```json
message.text = `creating ticket about "${message.args}"`;
message.attachments = [
   {
       type: "text",
       actions: [
           {
               type: "button",
               name: "action",
               value: "confirm",
               text: "Confirm",
               style: "primary",
           },
           {
               type: "button",
               name: "action",
               value: "cancel",
               text: "Cancel",
               style: "default",
           },
       ],
   }
];
```

The rewrite of the message text and attachment action will be reflected in the frontend.

##### Form Data
When a user interacts with one of the actions, the handler will be called again with an additional form_data attribute that will contain the chosen action:

```json
{
 "message": {
   ...
 },
 "user": {
   ...
 },
 "form_data": {
   "action": "confirm"
 }
}
```

Now that we have access to the chosen action, we can act accordingly. In case of a confirmation, we will finalize the message text and remove the previously added attachments. In case of cancel, we simply set the message to null, which will remove the message completely:

```javascript
const formData = req.body.form_data || {};
const action = formData["action"];

switch (action) {
   case "confirm":
       message.text = `ticket created about "${message.args}"`;
       message.attachments = null;
       break;
   case "cancel":
       message = null;
       break;
   default:
       ...
}
```

##### Message Types
The default message type is regular, which means it will be shown to everyone in the channel. It is common to set the message type to ephemeral while interacting with the command and set it to regular once the message has been finalized.

A 3rd type is error, which we can use to mark the message as invalid, eg. when command is missing a required argument.
```javascript
switch (action) {
   case "confirm":
       message.type = "regular";
       message.text = `ticket created about "${message.args}"`;
       message.attachments = null;
       break;
   case "cancel":
       message = null;
       break;
   default:
       if(message.args.trim() === "") {
           message.type = "error";
           message.text = "missing ticket description";
           break;
       }
       ...
```

#### Custom Command Interaction with MML
Using the attachment actions is limited to Buttons. If we want to use more elaborate interactions, we can use MML to create a form.

##### Rewrite Message MML field

Previously, we modified the text field and added an attachment with action on the message to communicate with the user. Now, we will replace these by rewriting the mml field instead:

```javascript
message.mml = `
   <mml name="ticket_form">
       <text>creating ticket about "${message.args}"</text>
       <row>
           <column width="2">By:</column>
           <column width="10">
               <input type="text" name="reported_by" value="${user.name}" />
           </column>
       </row>
       <button_list>
           <button name="action" value="confirm">Confirm</button>
           <button name="action" value="cancel">Cancel</button>     
       </button_list>
   </mml>
`;
```

This will display 2 buttons like before, and an additional text input field that will allow us to enter the name of the person that reported this ticket, with a default set to the user associated with the message.

Handling the form works similar to handling the attachment action, in fact we don’t have to change anything for those. We only need to capture the reported_by field and transform the remaining messages to mml equivalents:

```javascript
switch (action) {
   case "confirm":
       const reportedBy = formData["reported_by"];
       message.type = "regular";
       message.mml = `
           <mml>
               <text>ticket created about "${message.args} by ${reportedBy}"</text>
           </mml>
       `;
       message.attachments = null;
       break;
```

#### Standalone MML Messages & Interactions
Messages containing MML are not necessarily initiated by slash commands, but can also be sent through the client’s sendMessage api.

```javascript
channel.sendMessage({
   mml: `<mml name="mml_form">
           <text>This is a standalone mml message</text>
           <button name="action" value="ok" text="ok"/>
         </mml>`,
   user: {
       id: "bot",
       name: "Mr. Bot",
       image: "bender.jpg"
   }
});
```

When a user interacts with the message, the custom command handler endpoint will be called, with the command name set to mml. 

Additionally, the form data will include a field containing the mml name attribute value, called mml_name, that can be used to identify the form that initiated the request.
